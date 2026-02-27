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
import { PlusCircle, Camera, Upload, X, Trash2, Plus, AlertTriangle, UserPlus, User, RefreshCw, Loader2 } from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem, SubContractor } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

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
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };

    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetIdx !== null) {
      getCameraPermission();
    }

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
      canvas.width = 800; 
      canvas.height = 800 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = new Date();
      return { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: now.toISOString() };
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
        setItems(prev => prev.map((item, i) => {
          if (i === itemPhotoTargetIdx) {
            return { ...item, photos: [...(item.photos || []), photo] };
          }
          return item;
        }));
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
    if (items.length === 0) {
      toast({ title: 'Item Required', description: 'Please add at least one snagging item.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const uploadedGeneralPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/general/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedItems = await Promise.all(
          items.map(async (item, itemIdx) => {
            const upPhotos = await Promise.all(
              (item.photos || []).map(async (p, pIdx) => {
                if (p.url.startsWith('data:')) {
                  const blob = await dataUriToBlob(p.url);
                  const url = await uploadFile(storage, `snagging/items/${Date.now()}-${itemIdx}-${pIdx}.jpg`, blob);
                  return { ...p, url };
                }
                return p;
              })
            );
            return {
              ...item,
              id: `item-${Date.now()}-${itemIdx}`,
              photos: upPhotos
            };
          })
        );

        const data = {
          projectId: values.projectId,
          areaId: values.areaId || null,
          title: values.title,
          description: values.description || null,
          createdAt: new Date().toISOString(),
          photos: uploadedGeneralPhotos,
          items: uploadedItems.map(i => ({
            ...i,
            subContractorId: i.subContractorId || null,
            photos: i.photos || [],
            completionPhotos: i.completionPhotos || []
          })),
        };
        
        const colRef = collection(db, 'snagging-items');
        await addDoc(colRef, data).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data,
          }));
          throw error;
        });

        toast({ title: 'Success', description: 'Snagging list recorded.' });
        setOpen(false);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to save.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setItems([]);
      setNewItemText('');
      setPendingItemPhotos([]);
      setPendingSubId(undefined);
      setIsCameraOpen(false);
      setIsItemCameraOpen(false);
      setItemPhotoTargetIdx(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="mr-2 h-4 w-4" />New List</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Record New Snagging List</DialogTitle>
          <DialogDescription>Create a list of defects to be addressed in a specific project area.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger></FormControl>
                            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="areaId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Area (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId || availableAreas.length === 0}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select an area" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {availableAreas.length > 0 ? availableAreas.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            )) : <SelectItem value="none" disabled>No areas defined</SelectItem>}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List Title</FormLabel>
                      <FormControl><Input placeholder="e.g., Level 3 West Wing Snags" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <FormLabel className="text-base font-semibold">Defect Items</FormLabel>
                        <VoiceInput onResult={(text) => setNewItemText(text)} />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex gap-2 items-end">
                          <Input 
                              placeholder="Describe a defect..." 
                              value={newItemText} 
                              onChange={(e) => setNewItemText(e.target.value)} 
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                          />
                          <div className="flex gap-1 flex-shrink-0">
                            <Select value={pendingSubId || 'unassigned'} onValueChange={(val) => setPendingSubId(val === 'unassigned' ? undefined : val)}>
                              <SelectTrigger className="w-10 px-0 flex justify-center"><UserPlus className="h-4 w-4" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {projectSubs.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="outline" size="icon" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-4 w-4" /></Button>
                            <Button type="button" size="icon" onClick={handleAddItem}><Plus className="h-4 w-4" /></Button>
                          </div>
                      </div>

                      {isItemCameraOpen && (
                        <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                          <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={takeItemPhoto}>Capture</Button>
                            <Button type="button" variant="outline" size="sm" onClick={toggleCamera} title="Switch Camera"><RefreshCw className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsItemCameraOpen(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {pendingItemPhotos.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md border border-dashed">
                          {pendingItemPhotos.map((p, pIdx) => (
                            <div key={pIdx} className="relative w-12 h-12">
                              <Image src={p.url} alt="Item photo" fill className="rounded object-cover border" />
                              <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, idx) => idx !== pIdx))}><X className="h-2 w-2" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                        {items.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-4">No items added yet.</p>
                        ) : (
                            items.map((item, idx) => (
                                <div key={idx} className="space-y-2 bg-background p-3 rounded-md border shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">{item.description}</span>
                                            {item.subContractorId && <span className="text-[10px] text-muted-foreground">Assigned: {subContractors.find(s => s.id === item.subContractorId)?.name}</span>}
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                    {item.photos && item.photos.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {item.photos.map((p, pIdx) => (
                                                <div key={pIdx} className="relative w-12 h-12"><Image src={p.url} alt="Item photo" fill className="rounded object-cover border" /></div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <FormLabel>General Reference Photos</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-20 h-20"><Image src={p.url} alt="Snag" fill className="rounded-md object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>
                    ))}
                    <Button type="button" variant="outline" size="icon" className="w-20 h-20" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6" /></Button>
                  </div>
                  {isCameraOpen && (
                    <div className="space-y-2 border rounded-md p-2 bg-muted/30 mt-2">
                      <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={takeGeneralPhoto}>Capture</Button>
                        <Button type="button" variant="outline" size="sm" onClick={toggleCamera} title="Switch"><RefreshCw className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Snagging List
              </Button>
            </DialogFooter>
            <canvas ref={canvasRef} className="hidden" />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
