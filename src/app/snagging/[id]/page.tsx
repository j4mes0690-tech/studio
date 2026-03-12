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
import { doc, updateDoc, collection, addDoc, query, orderBy } from 'firebase/firestore';
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

function EditSnaggingContent() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { user: sessionUser } = useUser();
  const [isPending, startTransition] = useTransition();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();
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

  const selectedSub = useMemo(() => subContractors?.find(s => s.id === pendingSubId), [subContractors, pendingSubId]);

  // Camera handling
  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen || itemPhotoTargetId) getCameraPermission();
    return () => { 
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isCameraOpen, itemPhotoTargetId, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) return null;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = new Date();
      const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      context.font = 'bold 24px sans-serif';
      context.fillStyle = 'white';
      context.shadowColor = 'black';
      context.shadowBlur = 6;
      context.fillText(timestamp, canvas.width - context.measureText(timestamp).width - 20, canvas.height - 20);
      return { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: now.toISOString() };
    }
    return null;
  };

  const takeGeneralPhoto = () => {
    const p = capturePhoto();
    if (p) {
      setPhotos(prev => [...prev, p]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = () => {
    const p = capturePhoto();
    if (p && itemPhotoTargetId) {
      setItems(prev => prev.map(i => {
        if (i.id === itemPhotoTargetId) {
          const field = i.status === 'closed' ? 'completionPhotos' : 'photos';
          return { ...i, [field]: [...(i[field] || []), p] };
        }
        return i;
      }));
      setItemPhotoTargetId(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      setItems([...items, { 
        id: `item-${Date.now()}`, 
        description: newItemText.trim(), 
        status: 'open', 
        photos: [],
        subContractorId: pendingSubId
      }]);
      setNewItemText('');
      setPendingSubId(undefined);
    }
  };

  const handleSave = () => {
    if (!snagRef) return;
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Uploading media items...' });

        // 1. Upload overall list photos
        const uploadedGeneralPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/general/${id}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // 2. Upload individual item photos
        const uploadedItems = await Promise.all(
          items.map(async (item) => {
            const upPhotos = await Promise.all((item.photos || []).map(async (p, i) => {
              if (p.url.startsWith('data:')) {
                const blob = await dataUriToBlob(p.url);
                const url = await uploadFile(storage, `snagging/items/${id}-${item.id}-defect-${i}.jpg`, blob);
                return { ...p, url };
              }
              return p;
            }));

            const upCompletion = await Promise.all((item.completionPhotos || []).map(async (p, i) => {
              if (p.url.startsWith('data:')) {
                const blob = await dataUriToBlob(p.url);
                const url = await uploadFile(storage, `snagging/items/${id}-${item.id}-fixed-${i}.jpg`, blob);
                return { ...p, url };
              }
              return p;
            }));

            return { ...item, photos: upPhotos, completionPhotos: upCompletion };
          })
        );

        const updates = { 
          title, 
          description: description || null, 
          projectId, 
          areaId: areaId || null, 
          items: uploadedItems.map(i => ({
            ...i,
            subContractorId: i.subContractorId || null,
            photos: i.photos || [],
            completionPhotos: i.completionPhotos || []
          })), 
          photos: uploadedGeneralPhotos 
        };

        // Save Main List
        await updateDoc(snagRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: snagRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        // Record Version Snapshot
        const historyCol = collection(db, 'snagging-items', id, 'history');
        const closed = uploadedItems.filter(i => i.status === 'closed').length;
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: profile?.name || 'System User',
          items: uploadedItems,
          totalCount: uploadedItems.length,
          closedCount: closed,
          summary: 'Bulk list update via editor'
        });

        toast({ title: 'Success', description: 'Snagging list and version history saved.' });
        router.push('/snagging');

      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to upload media or save records.', variant: 'destructive' });
      }
    });
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
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isPending} className="gap-2 font-bold shadow-lg shadow-primary/20">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Record Snapshot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>List Metadata</CardTitle>
                <CardDescription>Basic information about this snagging area.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label>Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                        <SelectContent>
                        {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                    <Label>Area</Label>
                    <Select value={areaId} onValueChange={setAreaId}>
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
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Level 3 Snags" />
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Defect Items</CardTitle>
                <CardDescription>The specific tasks that need to be addressed.</CardDescription>
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
                            {selectedSub ? (
                                <Badge variant="secondary" className="h-6 text-[9px] font-black bg-primary/10 text-primary border-primary/20 max-w-[80px] truncate uppercase tracking-tighter">
                                    {selectedSub.name}
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
                                onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, status: i.status === 'open' ? 'closed' : 'open' } : i))}
                                className="mt-1 flex-shrink-0"
                            >
                                {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className={cn("font-medium break-words", listItem.status === 'closed' && "line-through text-muted-foreground")}>{listItem.description}</p>
                                <div className="mt-1">
                                  <Select 
                                    value={listItem.subContractorId || 'unassigned'} 
                                    onValueChange={(val) => setItems(items.map(i => i.id === listItem.id ? { ...i, subContractorId: val === 'unassigned' ? undefined : val } : i))}
                                  >
                                    <SelectTrigger className="h-5 w-auto inline-flex text-[10px] bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 px-2 py-0 gap-1 rounded-full font-bold uppercase tracking-tight shadow-none border-none">
                                      <User className="h-2 w-2" />
                                      <SelectValue placeholder="Assign Partner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                                      {projectSubs.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                            </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => setItemPhotoTargetId(listItem.id)} className="text-primary h-8 w-8"><Camera className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i => i.id !== listItem.id))} className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        {(listItem.photos?.length || 0) > 0 && (
                            <div className="pl-8 flex flex-wrap gap-2">
                            {listItem.photos?.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-16">
                                <Image src={p.url} alt="Defect" fill className="rounded object-cover border" />
                                <button onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, photos: i.photos?.filter((_, pi) => pi !== idx) } : i))} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"><X className="h-2 w-2" /></button>
                                </div>
                            ))}
                            </div>
                        )}

                        {(listItem.completionPhotos?.length || 0) > 0 && (
                            <div className="pl-8 space-y-1">
                            <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Completion Evidence</p>
                            <div className="flex flex-wrap gap-2">
                                {listItem.completionPhotos?.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-16">
                                    <Image src={p.url} alt="Fixed" fill className="rounded object-cover border border-green-200" />
                                    <button onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, completionPhotos: i.completionPhotos?.filter((_, pi) => pi !== idx) } : i))} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"><X className="h-2 w-2" /></button>
                                </div>
                                ))}
                            </div>
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
                    <div key={i} className="relative w-32 h-24">
                        <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
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
                        <span>Version History</span>
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
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-primary">Version {history.length - idx}</span>
                                                {idx === 0 && (
                                                  <Badge variant="secondary" className="h-4 px-1.5 text-[8px] bg-green-100 text-green-800 border-green-200 font-black">
                                                    CURRENT
                                                  </Badge>
                                                )}
                                                <Eye className="h-3.5 w-3.5 text-primary opacity-0 group-hover/hist:opacity-100 transition-opacity" />
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-medium"><ClientDate date={record.timestamp} /></span>
                                        </div>
                                        <p className="text-xs font-semibold text-foreground leading-snug">{record.summary}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-bold border-green-200 bg-green-50 text-green-700">
                                                {record.closedCount}/{record.totalCount} points
                                            </Badge>
                                            <span className="text-[9px] text-muted-foreground italic truncate max-w-[80px]">{record.updatedBy}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center gap-2 opacity-40">
                                    <History className="h-10 w-10" />
                                    <p className="text-xs font-bold uppercase">No records</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Snapshot Viewer Dialog */}
      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0 shrink-0">
                  <div className='flex items-center gap-3 mb-1'>
                      <div className='bg-primary/10 p-2 rounded-lg'>
                          <FileSearch className='h-5 w-5 text-primary' />
                      </div>
                      <div>
                          <DialogTitle>Historical Snapshot</DialogTitle>
                          <DialogDescription>Captured on <ClientDate date={viewingHistoryRecord?.timestamp || ''} /></DialogDescription>
                      </div>
                  </div>
              </DialogHeader>
              
              <div className='flex-1 overflow-y-auto px-6 py-4'>
                  <div className="space-y-4">
                      <div className='bg-muted/30 p-4 rounded-lg border border-dashed text-center space-y-1'>
                          <p className='text-[10px] font-black uppercase text-muted-foreground tracking-widest'>Audit Summary</p>
                          <p className='text-sm font-medium'>"{viewingHistoryRecord?.summary}"</p>
                          <div className='flex justify-center gap-2 mt-2'>
                              <Badge variant="secondary" className='bg-background'>{viewingHistoryRecord?.closedCount} / {viewingHistoryRecord?.totalCount} Fixed</Badge>
                              <Badge variant="outline" className='bg-background'>Authored by: {viewingHistoryRecord?.updatedBy}</Badge>
                          </div>
                      </div>

                      <div className="space-y-3 pt-2">
                          <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest px-1'>Point-in-Time Status</p>
                          {viewingHistoryRecord?.items.map((histItem) => {
                              const sub = subContractors?.find(s => s.id === histItem.subContractorId);
                              return (
                                  <div key={histItem.id} className="p-3 border rounded-lg bg-background shadow-sm space-y-3">
                                      <div className="flex items-start justify-between">
                                          <div className="flex items-start gap-3">
                                              {histItem.status === 'closed' ? (
                                                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                                              ) : (
                                                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                                              )}
                                              <div className='flex flex-col gap-1'>
                                                  <span className={cn("text-sm font-semibold", histItem.status === 'closed' && "line-through text-muted-foreground")}>
                                                      {histItem.description}
                                                  </span>
                                                  {sub && <span className="text-[10px] font-bold text-primary uppercase">{sub.name}</span>}
                                              </div>
                                          </div>
                                          <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[9px] uppercase font-bold h-5'>
                                              {histItem.status}
                                          </Badge>
                                      </div>

                                      {(histItem.photos && histItem.photos.length > 0) || (histItem.completionPhotos && histItem.completionPhotos.length > 0) ? (
                                          <div className='pl-7 flex flex-wrap gap-2 pt-1 border-t border-dashed'>
                                              {histItem.photos?.map((p, pi) => (
                                                  <div key={`hist-p-${pi}`} className='relative w-12 h-10 rounded border overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                      <Image src={p.url} alt="Snap" fill className='object-cover' />
                                                  </div>
                                              ))}
                                              {histItem.completionPhotos?.map((p, pi) => (
                                                  <div key={`hist-c-${pi}`} className='relative w-12 h-10 rounded border-2 border-green-200 overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                      <Image src={p.url} alt="Fix Snap" fill className='object-cover' />
                                                  </div>
                                              ))}
                                          </div>
                                      ) : null}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>

              <DialogFooter className='p-6 bg-muted/10 border-t shrink-0'>
                  <Button variant="outline" className='w-full' onClick={() => setViewingHistoryRecord(null)}>Close Auditor</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Unified Full-Screen Camera Overlay */}
      {(isCameraOpen || itemPhotoTargetId) && (
        <div className="fixed inset-0 z-[100] bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            <div className="flex justify-end">
              <Button 
                variant="secondary" 
                onClick={() => { setIsCameraOpen(false); setItemPhotoTargetId(null); }} 
                className="rounded-full h-12 px-6 font-bold shadow-lg"
              >
                Cancel
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-8 mb-8">
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full h-14 w-14 shadow-lg" 
                onClick={toggleCamera} 
                title="Switch Camera"
              >
                <RefreshCw className="h-7 w-7" />
              </Button>
              
              <Button 
                size="lg" 
                onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto} 
                className="rounded-full h-20 w-20 p-0 border-4 border-white/20 shadow-2xl bg-white hover:bg-white/90"
              >
                <div className="h-14 w-14 rounded-full border-2 border-black/10" />
              </Button>
              
              <div className="w-14" /> {/* Spacer for symmetry */}
            </div>
          </div>
        </div>
      )}

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default function SnaggingEditPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Edit Snagging List" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <EditSnaggingContent />
        </Suspense>
      </main>
    </div>
  );
}
