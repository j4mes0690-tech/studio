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
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';

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
    return subContractors.filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
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
    if (selectedAreaId && selectedAreaId !== 'none') {
      const area = availableAreas.find(a => a.id === selectedAreaId);
      if (area) {
        form.setValue('title', `${area.name} Completion Snags`);
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
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetIdx, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200; 
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() };
    }
    return null;
  };

  const takeGeneralPhoto = () => {
    const photo = capturePhoto();
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = () => {
    const photo = capturePhoto();
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

  const toggleCamera = () => setFacingMode(prev => prev === 'user' ? 'environment' : 'user');

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
        const uploadedGeneralPhotos = await Promise.all(photos.map(async (p, i) => {
          if (p.url.startsWith('data:')) {
            const blob = await dataUriToBlob(p.url);
            const url = await uploadFile(storage, `snagging/general/${Date.now()}-${i}.jpg`, blob);
            return { ...p, url };
          }
          return p;
        }));

        const uploadedItems = await Promise.all(items.map(async (item, itemIdx) => {
          const upPhotos = await Promise.all((item.photos || []).map(async (p, pIdx) => {
            if (p.url.startsWith('data:')) {
              const b = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/items/${Date.now()}-${itemIdx}-${pIdx}.jpg`, b);
              return { ...p, url };
            }
            return p;
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
          items: uploadedItems.map(i => ({ ...i, subContractorId: i.subContractorId || null, photos: i.photos || [], completionPhotos: i.completionPhotos || [] })),
        };
        
        const docRef = await addDoc(collection(db, 'snagging-items'), snagData);

        const historyCol = collection(db, 'snagging-items', docRef.id, 'history');
        const closed = snagData.items.filter(i => i.status === 'closed').length;
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: profile?.name || 'System User',
          items: snagData.items,
          totalCount: snagData.items.length,
          closedCount: closed,
          summary: 'List created'
        });

        toast({ title: 'Success', description: 'Snagging list recorded and initialized in history.' });
        setOpen(false);
      } catch (err: any) {
        console.error(err);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold shadow-lg shadow-primary/20"><PlusCircle className="mr-2 h-4 w-4" />New List</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b">
          <DialogTitle>Record New Snagging List</DialogTitle>
          <DialogDescription>Initiate a new verification list for a specific area.</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-6">
            <Form {...form}>
                <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem><FormLabel>Area / Level</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Identifier / Title</FormLabel><FormControl><Input placeholder="e.g. Master Suite Snags" className="h-11" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between"><FormLabel className="font-black text-xs uppercase tracking-widest text-muted-foreground">Add Defects</FormLabel><VoiceInput onResult={setNewItemText} /></div>
                        <div className="flex gap-2 items-end bg-background p-4 rounded-xl border shadow-sm">
                            <div className="flex-1">
                                <Input placeholder="Describe the required fix..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}} className="h-11 border-none shadow-none focus-visible:ring-0 px-0" />
                            </div>
                            <div className="flex gap-1">
                                <Select value={pendingSubId || 'unassigned'} onValueChange={(val) => setPendingSubId(val === 'unassigned' ? undefined : val)}>
                                    <SelectTrigger className={cn("px-2 flex items-center gap-2 border-none h-11 transition-all", pendingSubId ? "w-auto min-w-[40px]" : "w-10 justify-center")}>
                                        {selectedSub ? (
                                            <Badge variant="secondary" className="h-6 text-[9px] font-black bg-primary/10 text-primary border-primary/20 max-w-[80px] truncate uppercase tracking-tighter">
                                                {selectedSub.name}
                                            </Badge>
                                        ) : (
                                            <UserPlus className="h-4 w-4 text-primary" />
                                        )}
                                    </SelectTrigger>
                                    <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button type="button" variant="ghost" size="icon" className="h-11 w-11" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                                <Button type="button" size="icon" className="h-11 w-11 rounded-lg" onClick={handleAddItem}><Plus className="h-5 w-5" /></Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-bold text-foreground">{item.description}</span>
                                        <div className="flex gap-2">
                                            {item.subContractorId && <Badge variant="secondary" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20 px-1.5 h-4 uppercase">{subContractors.find(s => s.id === item.subContractorId)?.name}</Badge>}
                                            {item.photos && item.photos.length > 0 && <Badge variant="outline" className="text-[9px] font-bold h-4"><Camera className="h-2.5 w-2.5 mr-1" /> {item.photos.length} Photos</Badge>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setItemPhotoTargetIdx(idx)}><Camera className="h-4 w-4" /></Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormLabel className="font-black text-xs uppercase tracking-widest text-muted-foreground">General Area Documentation</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-24 h-24 group">
                                    <Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2 border-muted" />
                                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed hover:border-primary/50 hover:bg-primary/5" onClick={() => setIsCameraOpen(true)}>
                                <Camera className="h-6 w-6 text-muted-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Photo</span>
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0 gap-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)} disabled={isPending}>Discard</Button>
            <Button className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending || items.length === 0} onClick={form.handleSubmit(onSubmit)}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save Snagging List
            </Button>
        </DialogFooter>
        <canvas ref={canvasRef} className="hidden" />

        {/* Unified Camera Overlay */}
        {(isCameraOpen || isItemCameraOpen || itemPhotoTargetIdx !== null) && (
          <div className="fixed inset-0 z-[100] bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-end">
                <Button 
                  variant="secondary" 
                  onClick={() => { 
                    setIsCameraOpen(false); 
                    setIsItemCameraOpen(false); 
                    setItemPhotoTargetIdx(null); 
                  }} 
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
                
                <div className="w-14" /> {/* Spacer */}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
