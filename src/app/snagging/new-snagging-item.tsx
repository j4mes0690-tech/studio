'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Camera, Upload, X, Trash2, Plus, UserPlus, User, RefreshCw, Loader2, Save } from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem, SubContractor, DistributionUser } from '@/lib/types';
import { useFirestore, useStorage, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';

const SnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type NewSnaggingListFormValues = z.infer<typeof SnaggingListSchema>;

export function NewSnaggingItem({ projects, subContractors }: { projects: Project[], subContractors: SubContractor[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { user: sessionUser } = useUser();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<Omit<SnaggingListItem, 'id'>[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false); 
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetIdx, setItemPhotoTargetIdx] = useState<number | null>(null);

  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const form = useForm<NewSnaggingListFormValues>({
    resolver: zodResolver(SnaggingListSchema),
    defaultValues: { projectId: '', areaId: '', title: '', description: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const selectedAreaId = form.watch('areaId');

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  const selectedSub = useMemo(() => projectSubs.find(s => s.id === pendingSubId), [projectSubs, pendingSubId]);

  useEffect(() => {
    if (selectedProjectId) {
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', '');
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, selectedProject, form]);

  useEffect(() => {
    if (selectedAreaId && selectedAreaId !== 'none' && selectedAreaId !== '') {
      if (selectedAreaId === 'other') {
        // manual title - do not auto-overwrite
      } else {
        const area = availableAreas.find(a => a.id === selectedAreaId);
        if (area) {
          form.setValue('title', `${area.name} Completion Snags`);
        }
      }
    }
  }, [selectedAreaId, availableAreas, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {}
    };
    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetIdx !== null) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetIdx, facingMode]);

  const captureAndOptimize = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context || video.videoWidth === 0) return null;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1600;
      canvas.height = 1600 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const rawUri = canvas.toDataURL('image/jpeg', 0.9);
      const optimizedUri = await optimizeImage(rawUri);
      return { url: optimizedUri, takenAt: new Date().toISOString() };
    }
    return null;
  };

  const takeGeneralPhoto = async () => {
    const photo = await captureAndOptimize();
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = async () => {
    const photo = await captureAndOptimize();
    if (photo) {
      if (itemPhotoTargetIdx !== null) {
        setItems(prev => prev.map((item, i) => i === itemPhotoTargetIdx ? { ...item, photos: [...(item.photos || []), photo] } : item));
        setItemPhotoTargetIdx(null);
      } else {
        setPendingItemPhotos(prev => [...prev, photo]);
        setIsItemCameraOpen(false);
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleAddItem = () => {
    if (newItemText.trim() || pendingItemPhotos.length > 0) {
      setItems([...items, { 
        description: newItemText.trim() || 'No description', 
        status: 'open', 
        photos: pendingItemPhotos,
        subContractorId: pendingSubId
      }]);
      setNewItemText('');
      setPendingItemPhotos([]);
      setPendingSubId(undefined);
      setIsItemCameraOpen(false);
    }
  };

  const onSubmit = (values: NewSnaggingListFormValues) => {
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading optimized media...' });
        const uploadedGeneralPhotos = await Promise.all(photos.map(async (p, i) => {
          const blob = await dataUriToBlob(p.url);
          const url = await uploadFile(storage, `snagging/general/${Date.now()}-${i}.jpg`, blob);
          return { ...p, url };
        }));

        const uploadedItems = await Promise.all(items.map(async (item, itemIdx) => {
          const upPhotos = await Promise.all((item.photos || []).map(async (p, pIdx) => {
            const b = await dataUriToBlob(p.url);
            const url = await uploadFile(storage, `snagging/items/${Date.now()}-${itemIdx}-${pIdx}.jpg`, b);
            return { ...p, url };
          }));
          return { ...item, id: `item-${Date.now()}-${itemIdx}`, photos: upPhotos };
        }));

        const snagData = {
          projectId: values.projectId,
          areaId: values.areaId || null,
          title: values.title,
          description: values.description || null,
          createdAt: new Date().toISOString(),
          photos: uploadedGeneralPhotos,
          items: uploadedItems.map(i => ({ ...i, subContractorId: i.subContractorId || null, photos: i.photos || [], completionPhotos: [] })),
        };
        
        const docRef = await addDoc(collection(db, 'snagging-items'), snagData);

        const historyCol = collection(db, 'snagging-items', docRef.id, 'history');
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: profile?.name || 'System User',
          items: snagData.items,
          totalCount: snagData.items.length,
          closedCount: 0,
          summary: 'List created'
        });

        toast({ title: 'Success', description: 'Snagging list created.' });
        setOpen(false);
      } catch (err: any) {
        toast({ title: 'Error', description: 'Save failed.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="font-bold"><PlusCircle className="mr-2 h-4 w-4" />New List</Button></DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0"><DialogTitle>New Snagging List</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
            <Form {...form}>
                <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Area / Level</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                                    <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {availableAreas.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                      ))}
                                      {availableAreas.length > 0 && <Separator className="my-1" />}
                                      <SelectItem value="other">Other / Not Listed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center"><FormLabel className="font-black text-xs uppercase text-muted-foreground">Add Defects</FormLabel><VoiceInput onResult={setNewItemText} /></div>
                        <div className="flex gap-2 items-end bg-background p-4 rounded-xl border shadow-sm">
                            <div className="flex-1"><Input placeholder="Item description..." value={newItemText} onChange={e => setNewItemText(e.target.value)} className="h-11 border-none shadow-none focus-visible:ring-0 px-0" /></div>
                            <div className="flex gap-1">
                                <Select value={pendingSubId || 'unassigned'} onValueChange={v => setPendingSubId(v === 'unassigned' ? undefined : v)}>
                                    <SelectTrigger className={cn("px-2 border-none h-11 transition-all", pendingSubId ? "w-auto" : "w-10 justify-center")}>
                                        {selectedSub ? <Badge variant="secondary" className="h-6 text-[9px] uppercase tracking-tighter">{selectedSub.name}</Badge> : <UserPlus className="h-4 w-4 text-primary" />}
                                    </SelectTrigger>
                                    <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button type="button" variant="ghost" className="h-11" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                                <Button type="button" size="icon" className="h-11 rounded-lg" onClick={handleAddItem}><Plus className="h-5 w-5" /></Button>
                            </div>
                        </div>

                        {pendingItemPhotos.length > 0 && (
                          <div className="flex gap-2 p-3 bg-muted/20 rounded-xl border border-dashed">
                            {pendingItemPhotos.map((p, idx) => (
                              <div key={idx} className="relative w-16 h-12"><Image src={p.url} alt="Pre" fill className="rounded-md object-cover border" /><button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></button></div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group">
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <span className="text-sm font-bold truncate">{item.description}</span>
                                        <div className="mt-1 flex items-center gap-2">
                                            {item.subContractorId && <Badge variant="secondary" className="text-[10px]">{projectSubs.find(s => s.id === item.subContractorId)?.name}</Badge>}
                                            {item.photos && item.photos.length > 0 && <Badge variant="outline" className="text-[9px] h-4"><Camera className="h-2.5 w-2.5 mr-1" /> {item.photos.length} Photos</Badge>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setItemPhotoTargetIdx(idx)}><Camera className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormLabel className="font-black text-xs uppercase text-muted-foreground">General Documentation</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-24 h-24 group"><Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>
                            ))}
                            <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase tracking-tighter">Photo</span></Button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button type="button" variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>Discard</Button>
                        <Button type="button" className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending || items.length === 0} onClick={form.handleSubmit(onSubmit)}>{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}Save List</Button>
                    </div>
                </form>
            </Form>
        </div>

        {(isCameraOpen || isItemCameraOpen || itemPhotoTargetIdx !== null) && (
          <div className="fixed inset-0 z-[100] bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-end"><Button variant="secondary" onClick={() => { setIsCameraOpen(false); setIsItemCameraOpen(false); setItemPhotoTargetIdx(null); }} className="rounded-full h-12 px-6 font-bold">Cancel</Button></div>
              <div className="flex items-center justify-center gap-8 mb-8">
                <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={toggleCamera}><RefreshCw className="h-7 w-7" /></Button>
                <Button size="lg" onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto} className="rounded-full h-20 w-20 bg-white hover:bg-white/90"><div className="h-14 w-14 rounded-full border-2 border-black/10" /></Button>
                <div className="w-14" />
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
