'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useRef, useTransition, Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useCollection, useUser, useStorage, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, addDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, Area, DistributionUser, SnaggingHistoryRecord } from '@/lib/types';
import { ChevronLeft, Camera, Upload, X, Trash2, CheckCircle2, Circle, Plus, UserPlus, User, Loader2, Save, RefreshCw, History, Eye, FileSearch, Check } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VoiceInput } from '@/components/voice-input';
import { ImageLightbox } from '@/components/image-lightbox';
import { ClientDate } from '@/components/client-date';
import { CameraOverlay } from '@/components/camera-overlay';

function EditSnaggingContent() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { user: sessionUser } = useUser();
  const [isPending, startTransition] = useTransition();

  // Data
  const snagRef = useMemoFirebase(() => (db && id ? doc(db, 'snagging-items', id) : null), [db, id]);
  const { data: item, isLoading: itemLoading } = useDoc<SnaggingItem>(snagRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Version History Fetching
  const historyQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(collection(db, 'snagging-items', id, 'history'), orderBy('timestamp', 'desc'));
  }, [db, id]);
  const { data: history, isLoading: historyLoading } = useCollection<SnaggingHistoryRecord>(historyQuery);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [items, setItems] = useState<SnaggingListItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Local UI State
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Sync initial data
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setProjectId(item.projectId || '');
      setAreaId(item.areaId || '');
      setItems(item.items || []);
      setPhotos(item.photos || []);
    }
  }, [item]);

  // Derived
  const selectedProject = useMemo(() => allProjects?.find(p => p.id === projectId), [allProjects, projectId]);
  const availableAreas = selectedProject?.areas || [];

  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const projectSubs = useMemo(() => {
    if (!projectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [projectId, selectedProject, subContractors]);

  const isAuthorized = useMemo(() => {
    if (!profile || !item) return false;
    if (profile.permissions?.hasFullVisibility) return true;
    return allowedProjects.some(p => p.id === item.projectId);
  }, [profile, item, allowedProjects]);

  const onCaptureGeneral = (photo: Photo) => {
    if (snagRef) {
      startTransition(async () => {
        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `snagging/general/${id}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        await updateDoc(snagRef, {
          photos: arrayUnion(updatedPhoto)
        });
        setPhotos(prev => [...prev, updatedPhoto]);
      });
    }
  };

  const onCaptureItem = (photo: Photo) => {
    if (itemPhotoTargetId && snagRef) {
      startTransition(async () => {
        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `snagging/items/${itemPhotoTargetId}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        const newItems = items.map(itm => itm.id === itemPhotoTargetId ? { ...itm, photos: [...(itm.photos || []), updatedPhoto] } : itm);
        setItems(newItems);
        await updateDoc(snagRef, { items: newItems });
      });
      setItemPhotoTargetId(null);
    }
  };

  const handleMetadataChange = (key: string, value: any) => {
    if (!snagRef) return;
    updateDoc(snagRef, { [key]: value });
  };

  const handleAddItem = () => {
    if (!newItemText.trim() || !snagRef) return;
    startTransition(async () => {
        const newItem: SnaggingListItem = {
            id: `item-${Date.now()}`,
            description: newItemText.trim(),
            status: 'open',
            photos: [],
            subContractorId: pendingSubId || null,
            completionPhotos: []
        };
        const newItemsList = [...items, newItem];
        setItems(newItemsList);
        await updateDoc(snagRef, { items: newItemsList });
        setNewItemText('');
        setPendingSubId(undefined);
    });
  };

  const handleRemoveItem = (itemId: string) => {
    if (!snagRef) return;
    const newItemsList = items.filter(i => i.id !== itemId);
    setItems(newItemsList);
    updateDoc(snagRef, { items: newItemsList });
  };

  const handleToggleStatus = (itemId: string) => {
    if (!snagRef) return;
    const newItemsList = items.map(i => i.id === itemId ? { ...i, status: (i.status === 'open' ? 'closed' : 'open') as any } : i);
    setItems(newItemsList);
    updateDoc(snagRef, { items: newItemsList });
  };

  if (itemLoading || projectsLoading || subsLoading || profileLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-muted-foreground">You do not have permission to edit this record.</p>
        <Button onClick={() => router.push('/snagging')}>Return to Log</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/snagging')} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Back to Log
            </Button>
            {isPending && <Badge variant="secondary" className="animate-pulse">Saving changes...</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>List Metadata</CardTitle>
                <CardDescription>Changes to project, area, or title are saved on change.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label>Project</Label>
                    <Select value={projectId} onValueChange={(v) => { setProjectId(v); handleMetadataChange('projectId', v); }}>
                        <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>
                        {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                    <Label>Area</Label>
                    <Select value={areaId} onValueChange={(v) => { setAreaId(v); handleMetadataChange('areaId', v); }}>
                        <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                        <SelectContent>
                        {availableAreas.length > 0 ? availableAreas.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        )) : <SelectItem value="none" disabled>No areas defined</SelectItem>}
                        <Separator className="my-1" />
                        <SelectItem value="other">Other / Not Listed</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>List Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => handleMetadataChange('title', title)} placeholder="e.g. Level 3 Snags" />
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Defect Items</CardTitle>
                <CardDescription>The specific tasks that need to be addressed. Additions are persisted immediately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Add New Defect</Label>
                        <VoiceInput onResult={(text) => setNewItemText(text)} />
                    </div>
                    <Input 
                        placeholder="Describe the issue..." 
                        value={newItemText} 
                        onChange={(e) => setNewItemText(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                    />
                    </div>
                    <div className="flex gap-1">
                    <Select value={pendingSubId || 'unassigned'} onValueChange={val => setPendingSubId(val === 'unassigned' ? undefined : val)}>
                        <SelectTrigger className={cn("px-2 flex items-center gap-2 transition-all", pendingSubId ? "w-auto min-w-[40px]" : "w-10 justify-center")}>
                            {pendingSubId ? (
                                <Badge variant="secondary" className="h-6 text-[9px] font-black bg-primary/10 text-primary border-primary/20 max-w-[80px] truncate uppercase tracking-tighter">
                                    {projectSubs.find(s => s.id === pendingSubId)?.name}
                                </Badge>
                            ) : (
                                <UserPlus className="h-4 w-4 text-primary" />
                            )}
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button type="button" onClick={handleAddItem} size="icon"><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="space-y-4">
                    {items.map((listItem) => {
                    const sub = subContractors?.find(s => s.id === listItem.subContractorId);
                    return (
                        <div key={listItem.id} className="p-4 border rounded-lg bg-muted/10 space-y-3 group transition-all hover:border-primary/20">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                            <button 
                                onClick={() => handleToggleStatus(listItem.id)}
                                className="mt-1 flex-shrink-0"
                            >
                                {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className={cn("font-medium break-words", listItem.status === 'closed' && "line-through text-muted-foreground")}>{listItem.description}</p>
                                {sub && <Badge variant="secondary" className="mt-1 text-[9px] font-bold uppercase tracking-tight">{sub.name}</Badge>}
                            </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => setItemPhotoTargetId(listItem.id)} className="text-primary h-8 w-8"><Camera className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(listItem.id)} className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        {listItem.photos && listItem.photos.length > 0 && (
                            <div className="pl-8 flex flex-wrap gap-2">
                            {listItem.photos.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-16 cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                    <Image src={p.url} alt="Defect" fill className="rounded object-cover border" />
                                </div>
                            ))}
                            </div>
                        )}
                        </div>
                    );
                    })}
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Site Documentation</CardTitle>
                <CardDescription>General photos for this area.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                    {photos.map((p, i) => (
                    <div key={i} className="relative w-32 h-24 group cursor-pointer" onClick={() => setViewingPhoto(p)}>
                        <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                    </div>
                    ))}
                    <Button variant="outline" className="w-32 h-24 flex flex-col gap-2 border-dashed hover:bg-muted/50" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="h-6 w-6 text-primary" />
                    <span className="text-xs font-bold uppercase">Take Photo</span>
                    </Button>
                </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="sticky top-6">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        <History className="h-4 w-4 text-primary" />
                        <span>Audit Log</span>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[calc(100vh-250px)]">
                        <div className="space-y-4 pr-4">
                            {history && history.length > 0 ? history.map((record, idx) => (
                                <div 
                                    key={record.id} 
                                    className="relative pl-4 border-l-2 border-primary/20 pb-4 last:pb-0 cursor-pointer group/hist transition-all hover:bg-muted/30 rounded-r-md"
                                    onClick={() => setViewingHistoryRecord(record)}
                                >
                                    <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-primary">V{history.length - idx}</span>
                                            <span className="text-[9px] text-muted-foreground font-medium"><ClientDate date={record.timestamp} format="date" /></span>
                                        </div>
                                        <p className="text-xs font-semibold text-foreground leading-snug truncate">{record.summary}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-muted-foreground italic text-center py-8">No revision history found.</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0 shrink-0">
                  <DialogTitle>Historical Snapshot</DialogTitle>
                  <DialogDescription>Captured on <ClientDate date={viewingHistoryRecord?.timestamp || ''} /></DialogDescription>
              </DialogHeader>
              <div className='flex-1 overflow-y-auto px-6 py-4'>
                  <div className="space-y-4">
                      {viewingHistoryRecord?.items.map((histItem) => (
                          <div key={histItem.id} className="p-3 border rounded-lg bg-background flex items-center justify-between">
                              <span className={cn("text-sm", histItem.status === 'closed' && "line-through text-muted-foreground")}>{histItem.description}</span>
                              <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[9px] uppercase font-bold'>{histItem.status}</Badge>
                          </div>
                      ))}
                  </div>
              </div>
              <DialogFooter className='p-6 border-t'>
                  <Button variant="outline" className='w-full' onClick={() => setViewingHistoryRecord(null)}>Close Auditor</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCaptureGeneral}
        title="Audit Evidence"
      />

      <CameraOverlay 
        isOpen={itemPhotoTargetId !== null} 
        onClose={() => setItemPhotoTargetId(null)} 
        onCapture={onCaptureItem}
        title="Defect Documentation"
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  );
}

export default function SnaggingDetailPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Project Snagging Auditor" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
          <EditSnaggingContent />
        </Suspense>
      </main>
    </div>
  );
}
