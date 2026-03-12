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
import { Pencil, Camera, Upload, X, Trash2, Plus, UserPlus, User, RefreshCw, Loader2, Save, History, Eye, FileSearch } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem, SubContractor, SnaggingHistoryRecord } from '@/lib/types';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/client-date';

const EditSnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type EditSnaggingListFormValues = z.infer<typeof EditSnaggingListSchema>;

export function EditSnaggingItem({ item, projects, subContractors }: { item: SnaggingItem, projects: Project[], subContractors: SubContractor[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<SnaggingListItem[]>(item.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);

  const historyQuery = useMemoFirebase(() => {
    if (!db || !item.id) return null;
    return query(collection(db, 'snagging-items', item.id, 'history'), orderBy('timestamp', 'desc'));
  }, [db, item.id]);
  const { data: history } = useCollection<SnaggingHistoryRecord>(historyQuery);

  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);

  const form = useForm<EditSnaggingListFormValues>({
    resolver: zodResolver(EditSnaggingListSchema),
    defaultValues: { projectId: item.projectId, areaId: item.areaId || '', title: item.title || '', description: item.description || '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    if (selectedProjectId) setAreas(selectedProject?.areas || []);
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (open) {
      form.reset({ projectId: item.projectId, areaId: item.areaId || '', title: item.title || '', description: item.description || '' });
      setPhotos(item.photos || []);
      setItems(item.items || []);
    }
  }, [open, item, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {}
    };
    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetId !== null) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetId, facingMode]);

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
      const optimizedUri = await optimizeImage(canvas.toDataURL('image/jpeg', 0.9));
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
      if (itemPhotoTargetId) {
        setItems(prev => prev.map(i => i.id === itemPhotoTargetId ? { ...i, photos: [...(i.photos || []), photo] } : i));
        setItemPhotoTargetId(null);
      } else {
        setPendingItemPhotos(prev => [...prev, photo]);
        setIsItemCameraOpen(false);
      }
    }
  };

  const onSubmit = (values: EditSnaggingListFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Persisting optimized assets...' });
        const upGeneral = await Promise.all(photos.map(async (p, i) => {
          if (p.url.startsWith('data:')) {
            const blob = await dataUriToBlob(p.url);
            const url = await uploadFile(storage, `snagging/general/${item.id}-${Date.now()}-${i}.jpg`, blob);
            return { ...p, url };
          }
          return p;
        }));

        const upItems = await Promise.all(items.map(async (itm) => {
          const pDefects = await Promise.all((itm.photos || []).map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const b = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/items/${itm.id}-defect-${i}.jpg`, b);
              return { ...p, url };
            }
            return p;
          }));
          return { ...itm, photos: pDefects, subContractorId: itm.subContractorId || null };
        }));

        const docRef = doc(db, 'snagging-items', item.id);
        const updates = { ...values, items: upItems, photos: upGeneral };
        await updateDoc(docRef, updates);

        const historyCol = collection(db, 'snagging-items', item.id, 'history');
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: 'System User', 
          items: upItems,
          totalCount: upItems.length,
          closedCount: upItems.filter(i => i.status === 'closed').length,
          summary: 'Bulk update'
        });

        toast({ title: 'Success', description: 'Snapshot recorded.' });
        setOpen(false);
      } catch (err: any) {
        toast({ title: 'Error', description: 'Save failed.', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-0"><DialogTitle>Edit Snagging List</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="projectId" render={({ field }) => (
                          <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                      )} />
                      <FormField control={form.control} name="areaId" render={({ field }) => (
                          <FormItem><FormLabel>Area</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  
                  <Separator />

                  <div className="space-y-4">
                    <FormLabel>Items</FormLabel>
                    <div className="space-y-3">
                        {items.map((listItem, idx) => (
                            <div key={idx} className="p-3 border rounded-md bg-muted/10 flex items-center justify-between">
                                <span className={cn("text-sm", listItem.status === 'closed' && "line-through opacity-50")}>{listItem.description}</span>
                                <div className="flex gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItemPhotoTargetId(listItem.id)}><Camera className="h-4 w-4" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)}>Discard</Button>
                    <Button type="submit" disabled={isPending} className="w-full sm:flex-1 h-12 font-bold gap-2">
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save List Snapshot
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </form>
          </Form>
        </DialogContent>

        {(isCameraOpen || isItemCameraOpen || itemPhotoTargetId !== null) && (
          <div className="fixed inset-0 z-[100] bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-end"><Button variant="secondary" onClick={() => { setIsCameraOpen(false); setIsItemCameraOpen(false); setItemPhotoTargetId(null); }} className="rounded-full h-12 px-6 font-bold">Cancel</Button></div>
              <div className="flex items-center justify-center gap-8 mb-8">
                <Button variant="secondary" size="icon" className="rounded-full h-14 w-14" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-7 w-7" /></Button>
                <Button size="lg" onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto} className="rounded-full h-20 w-20 bg-white"><div className="h-14 w-14 rounded-full border-2 border-black/10" /></Button>
                <div className="w-14" />
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </Dialog>
    </>
  );
}
