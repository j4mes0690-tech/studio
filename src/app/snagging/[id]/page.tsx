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
import { doc, updateDoc, collection, query, orderBy, arrayUnion, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, Area, DistributionUser, SnaggingHistoryRecord } from '@/lib/types';
import { ChevronLeft, Camera, Upload, X, Trash2, CheckCircle2, Circle, Plus, UserPlus, User, RefreshCw, Loader2, Save, History, Eye, FileSearch, Check, Link as LinkIcon, Pencil, Maximize2, ListChecks } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { VoiceInput } from '@/components/voice-input';
import { ImageLightbox } from '@/components/image-lightbox';
import { ClientDate } from '../../components/client-date';
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

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

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
  const [projectId, setProjectId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [items, setItems] = useState<SnaggingListItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Local UI State
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string>('unassigned');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  
  // Item Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemSubId, setEditItemSubId] = useState<string>('unassigned');

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false);
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Sync initial data
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
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
        
        const newItems = items.map(itm => 
          itm.id === itemPhotoTargetId 
            ? { ...itm, photos: [...(itm.photos || []), updatedPhoto] } 
            : itm
        );
        setItems(newItems);
        await updateDoc(snagRef, { items: newItems });
      });
      setItemPhotoTargetId(null);
    } else {
      setPendingItemPhotos(prev => [...prev, photo]);
    }
  };

  const handleMetadataChange = (key: string, value: any) => {
    if (!snagRef) return;
    updateDoc(snagRef, { [key]: value });
  };

  const handleAddItem = () => {
    if (!newItemText.trim() && pendingItemPhotos.length === 0) return;
    if (!snagRef) return;

    startTransition(async () => {
        try {
            const uploadedPhotos = await Promise.all(
                pendingItemPhotos.map(async (p, i) => {
                    const blob = await dataUriToBlob(p.url);
                    const url = await uploadFile(storage, `snagging/items/${Date.now()}-${i}.jpg`, blob);
                    return { ...p, url };
                })
            );

            const newItem: SnaggingListItem = {
                id: `item-${Date.now()}`,
                description: newItemText.trim() || 'No description',
                status: 'open',
                photos: uploadedPhotos,
                subContractorId: pendingSubId === 'unassigned' ? null : pendingSubId,
                completionPhotos: []
            };
            const newItemsList = [...items, newItem];
            setItems(newItemsList);
            await updateDoc(snagRef, { items: newItemsList });
            setNewItemText('');
            setPendingSubId('unassigned');
            setPendingItemPhotos([]);
            toast({ title: 'Item Added', description: 'Saved to snagging list.' });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to add item.', variant: 'destructive' });
        }
    });
  };

  const handleStartEdit = (snag: SnaggingListItem) => {
    setEditingItemId(snag.id);
    setEditItemText(snag.description);
    setEditItemSubId(snag.subContractorId || 'unassigned');
  };

  const handleSaveItemEdit = (itemId: string) => {
    if (!snagRef) return;
    const newItemsList = items.map(i => 
      i.id === itemId 
        ? { ...i, description: editItemText, subContractorId: editItemSubId === 'unassigned' ? null : editItemSubId } 
        : i
    );
    setItems(newItemsList);
    updateDoc(snagRef, { items: newItemsList });
    setEditingItemId(null);
  };

  const handleRemoveItem = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!snagRef) return;
    const newItemsList = items.filter(i => i.id !== itemId);
    setItems(newItemsList);
    updateDoc(snagRef, { items: newItemsList });
  };

  const handleToggleStatus = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    if (!snagRef) return;
    const newItemsList = items.map(i => i.id === itemId ? { ...i, status: (i.status === 'open' ? 'closed' : 'open') as any } : i);
    setItems(newItemsList);
    updateDoc(snagRef, { items: newItemsList });
  };

  const handleRemovePhoto = (e: React.MouseEvent, itemId: string, photoIdx: number) => {
    e.stopPropagation();
    if (!snagRef) return;
    const newItemsList = items.map(itm => {
        if (itm.id === itemId) {
            return { ...itm, photos: (itm.photos || []).filter((_, i) => i !== photoIdx) };
        }
        return itm;
    });
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
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 md:px-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push('/snagging')} className="gap-2">
                <ChevronLeft className="h-4 w-4" /> Back to Log
            </Button>
            {isPending && <Badge variant="secondary" className="animate-pulse">Syncing changes...</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-primary/10">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Audit Metadata</CardTitle>
                    <CardDescription>Target area and project identification.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Project</Label>
                            <Select value={projectId} onValueChange={(v) => { setProjectId(v); handleMetadataChange('projectId', v); }}>
                                <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Select project" /></SelectTrigger>
                                <SelectContent>{allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Plot / Level</Label>
                            <Select value={areaId} onValueChange={(v) => { setAreaId(v); handleMetadataChange('areaId', v); }}>
                                <SelectTrigger className="bg-background h-10"><SelectValue placeholder="Select area" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="site-wide">General Site</SelectItem>
                                    {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                    <Separator className="my-1" />
                                    <SelectItem value="other">Other / Manual Entry</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">List Reference Title</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => handleMetadataChange('title', title)} placeholder="e.g. Plot 4 - First Fix Completion" className="h-10" />
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-primary/10 overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Requirement Log</CardTitle>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">{item.reference}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-6 bg-muted/20 border-b space-y-4">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Record New Defect</Label>
                                    <VoiceInput onResult={(text) => setNewItemText(text)} />
                                </div>
                                <Input 
                                    placeholder="Describe the issue found..." 
                                    value={newItemText} 
                                    onChange={(e) => setNewItemText(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                                    className="bg-background h-11"
                                />
                            </div>
                            <div className="flex gap-1">
                                <Select value={pendingSubId} onValueChange={setPendingSubId}>
                                    <SelectTrigger className="w-10 md:w-40 bg-background h-11 px-2 justify-center">
                                        <div className="flex items-center gap-2">
                                            {pendingSubId !== 'unassigned' ? (
                                                <Badge variant="secondary" className="hidden md:block h-6 text-[9px] font-black max-w-[100px] truncate uppercase">
                                                    {projectSubs.find(s => s.id === pendingSubId)?.name}
                                                </Badge>
                                            ) : <UserPlus className="h-4 w-4 text-primary" />}
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">TBC / Unassigned</SelectItem>
                                        {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="outline" className="h-11 border-dashed" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                                <Button type="button" onClick={handleAddItem} disabled={!newItemText.trim() && pendingItemPhotos.length === 0} className="h-11 w-11 shrink-0"><Plus className="h-5 w-5" /></Button>
                            </div>
                        </div>

                        {pendingItemPhotos.length > 0 && (
                            <div className="flex gap-2 p-3 bg-white/50 rounded-xl border-2 border-dashed border-primary/20 animate-in fade-in zoom-in">
                                {pendingItemPhotos.map((p, idx) => (
                                    <div key={idx} className="relative w-16 h-12 rounded border shadow-sm">
                                        <Image src={p.url} alt="Pre" fill className="object-cover rounded" />
                                        <button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-2 w-2" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="divide-y overflow-hidden">
                        {items.length === 0 ? (
                            <div className="py-20 text-center text-muted-foreground opacity-40">
                                <ListChecks className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm font-medium">No defects recorded for this area.</p>
                            </div>
                        ) : items.map((listItem, idx) => {
                            const sub = subContractors?.find(s => s.id === listItem.subContractorId);
                            const isEditing = editingItemId === listItem.id;

                            return (
                                <div 
                                    key={listItem.id} 
                                    className={cn(
                                        "p-4 transition-all",
                                        isEditing ? "bg-primary/[0.03] ring-2 ring-inset ring-primary/20" : "hover:bg-muted/5 cursor-pointer"
                                    )}
                                    onClick={() => !isEditing && handleStartEdit(listItem)}
                                >
                                    {isEditing ? (
                                        <div className="space-y-4 animate-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Editing Item Details</Label>
                                                <Badge variant="outline" className="text-[8px]">Active Edit</Badge>
                                            </div>
                                            <Input 
                                                value={editItemText} 
                                                onChange={e => setEditItemText(e.target.value)} 
                                                className="h-10 bg-background font-medium"
                                                autoFocus
                                            />
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <Select value={editItemSubId} onValueChange={setEditItemSubId}>
                                                    <SelectTrigger className="w-full sm:w-64 bg-background h-9 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">TBC / Unassigned</SelectItem>
                                                        {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <Button variant="outline" size="sm" onClick={() => { setItemPhotoTargetId(listItem.id); setIsItemCameraOpen(true); }} className="h-9 gap-2">
                                                        <Camera className="h-4 w-4" /> Evidence
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingItemId(null)} className="h-9">Cancel</Button>
                                                    <Button size="sm" onClick={() => handleSaveItemEdit(listItem.id)} className="h-9 gap-2 px-4 font-bold shadow-sm">
                                                        <Check className="h-4 w-4" /> Save
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Item Photos</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {(listItem.photos || []).map((p, pIdx) => (
                                                        <div key={pIdx} className="relative w-20 h-16 rounded-md border-2 border-primary/10 overflow-hidden group/img">
                                                            <Image src={p.url} alt="Defect" fill className="object-cover" />
                                                            <button 
                                                                type="button" 
                                                                className="absolute top-0 right-0 bg-destructive text-white p-1 shadow-md transition-opacity"
                                                                onClick={(e) => handleRemovePhoto(e, listItem.id, pIdx)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!listItem.photos || listItem.photos.length === 0) && (
                                                        <p className="text-[10px] text-muted-foreground italic">No photos attached.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => handleToggleStatus(e, listItem.id)}
                                                    className="mt-1 flex-shrink-0 transition-transform active:scale-90 hover:scale-110"
                                                >
                                                    {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={cn(
                                                        "text-sm font-bold leading-relaxed",
                                                        listItem.status === 'closed' && "line-through text-muted-foreground opacity-60"
                                                    )}>
                                                        {listItem.description}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        {sub && <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter bg-primary/5 text-primary border-primary/10">{sub.name}</Badge>}
                                                        {listItem.photos && listItem.photos.length > 0 && (
                                                            <div className="flex -space-x-2">
                                                                {listItem.photos.slice(0, 3).map((p, i) => (
                                                                    <div key={i} className="h-5 w-5 rounded-full border-2 border-background overflow-hidden relative">
                                                                        <Image src={p.url} alt="Ev" fill className="object-cover" />
                                                                    </div>
                                                                ))}
                                                                {listItem.photos.length > 3 && <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[7px] font-bold">+{listItem.photos.length - 3}</div>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleRemoveItem(e, listItem.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="sticky top-6 shadow-sm border-primary/10">
                <CardHeader className="pb-3 border-b bg-muted/10">
                    <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Global Evidence</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3">
                        {photos.map((p, i) => (
                            <div key={i} className="relative aspect-video rounded-lg border-2 border-muted overflow-hidden group cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                <Image src={p.url} alt="Context" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <Maximize2 className="h-4 w-4 text-white" />
                                </div>
                                <button 
                                    type="button" 
                                    className="absolute top-1 right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-md" 
                                    onClick={(e) => { e.stopPropagation(); handleMetadataChange('photos', photos.filter((_, idx) => idx !== i)); }}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        ))}
                        <Button 
                            variant="outline" 
                            className="aspect-video h-auto flex flex-col gap-2 border-dashed border-2 hover:bg-primary/5 hover:border-primary/30 transition-all rounded-lg" 
                            onClick={() => setIsCameraOpen(true)}
                        >
                            <Camera className="h-6 w-6 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Capture</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="sticky top-[320px] shadow-sm border-primary/10">
                <CardHeader className="pb-3 border-b bg-muted/10">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Timeline Audit</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <ScrollArea className="h-64">
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
                                            <span className="text-[9px] font-black uppercase text-primary">Rev {history.length - idx}</span>
                                            <span className="text-[9px] text-muted-foreground font-medium"><ClientDate date={record.timestamp} format="date" /></span>
                                        </div>
                                        <p className="text-xs font-semibold text-foreground leading-snug truncate">{record.summary}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-muted-foreground italic text-center py-8">No historical snapshots recorded.</p>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
      </div>

      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl shadow-2xl">
              <DialogHeader className="p-6 pb-0 shrink-0">
                  <DialogTitle>Historical Snapshot</DialogTitle>
                  <DialogDescription>Audit state captured on <ClientDate date={viewingHistoryRecord?.timestamp || ''} /></DialogDescription>
              </DialogHeader>
              <div className='flex-1 overflow-y-auto px-6 py-4'>
                  <div className="space-y-4">
                      {viewingHistoryRecord?.items.map((histItem) => (
                          <div key={histItem.id} className="p-3 border rounded-lg bg-background flex items-center justify-between">
                              <span className={cn("text-sm font-medium", histItem.status === 'closed' && "line-through text-muted-foreground")}>{histItem.description}</span>
                              <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[9px] uppercase font-bold'>{histItem.status}</Badge>
                          </div>
                      ))}
                  </div>
              </div>
              <DialogFooter className='p-6 border-t bg-muted/5'>
                  <Button variant="outline" className='w-full' onClick={() => setViewingHistoryRecord(null)}>Close Auditor</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCaptureGeneral}
        title="Area Documentation"
      />

      <CameraOverlay 
        isOpen={isItemCameraOpen || itemPhotoTargetId !== null} 
        onClose={() => { setIsItemCameraOpen(false); setItemPhotoTargetId(null); }} 
        onCapture={onCaptureItem}
        title="Defect Documentation"
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  );
}

export default function SnaggingDetailPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-muted/5">
      <Header title="Snag List Auditor" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
          <EditSnaggingContent />
        </Suspense>
      </main>
    </div>
  );
}
