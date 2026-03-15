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
import { Pencil, Camera, Upload, X, Trash2, Plus, UserPlus, User, RefreshCw, Loader2, Save, History, Eye, FileSearch } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem, SubContractor, SnaggingHistoryRecord, DistributionUser } from '@/lib/types';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy, addDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);

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

  const toggleCamera = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const closeCamera = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCameraOpen(false);
    setItemPhotoTargetId(null);
  };

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

  const handleMetadataChange = () => {
    const values = form.getValues();
    startTransition(async () => {
        await updateDoc(doc(db, 'snagging-items', item.id), {
            ...values,
            areaId: values.areaId || null,
            description: values.description || null
        });
    });
  }

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
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
        await updateDoc(doc(db, 'snagging-items', item.id), { items: newItemsList });
        setNewItemText('');
        setPendingSubId(undefined);
    });
  };

  const handleRemoveItem = (id: string) => {
    const newItemsList = items.filter(i => i.id !== id);
    setItems(newItemsList);
    updateDoc(doc(db, 'snagging-items', item.id), { items: newItemsList });
  };

  const takeGeneralPhoto = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const photo = await captureAndOptimize();
    if (photo) {
      startTransition(async () => {
        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `snagging/general/${item.id}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        await updateDoc(doc(db, 'snagging-items', item.id), {
          photos: arrayUnion(updatedPhoto)
        });
        setPhotos(prev => [...prev, updatedPhoto]);
      });
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const photo = await captureAndOptimize();
    if (photo && itemPhotoTargetId) {
      startTransition(async () => {
        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `snagging/items/${itemPhotoTargetId}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        const newItems = items.map(itm => itm.id === itemPhotoTargetId ? { ...itm, photos: [...(itm.photos || []), updatedPhoto] } : itm);
        setItems(newItems);
        await updateDoc(doc(db, 'snagging-items', item.id), { items: newItems });
      });
      setItemPhotoTargetId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-6 pb-0 border-b shrink-0 flex flex-row items-center justify-between">
            <div>
                <DialogTitle>Snagging List Editor</DialogTitle>
                <DialogDescription>Changes are saved automatically.</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
                {isPending && <Badge variant="secondary" className="animate-pulse">Auto-saving...</Badge>}
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <Form {...form}>
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="projectId" render={({ field }) => (
                            <FormItem><FormLabel>Project</FormLabel><Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name="areaId" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Area</FormLabel>
                              <Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                  {availableAreas.length > 0 && <Separator className="my-1" />}
                                  <SelectItem value="other">Other / Not Listed</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} onBlur={handleMetadataChange} /></FormControl></FormItem>
                    )} />
                    
                    <Separator />

                    <div className="space-y-4">
                      <FormLabel>Manage Items</FormLabel>
                      
                      <div className="flex gap-2 items-end bg-muted/20 p-3 rounded-lg border">
                          <div className="flex-1">
                              <Input placeholder="Add new snag..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}} />
                          </div>
                          <Select value={pendingSubId || 'unassigned'} onValueChange={v => setPendingSubId(v === 'unassigned' ? undefined : v)}>
                              <SelectTrigger className="w-40"><SelectValue placeholder="Assign" /></SelectTrigger>
                              <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddItem(); }} disabled={!newItemText.trim()}><Plus className="h-4 w-4" /></Button>
                      </div>

                      <div className="space-y-3">
                          {items.map((listItem) => (
                              <div key={listItem.id} className="p-3 border rounded-md bg-muted/10 flex items-center justify-between animate-in slide-in-from-left-1">
                                  <div className="flex flex-col">
                                      <span className={cn("text-sm font-bold", listItem.status === 'closed' && "line-through opacity-50")}>{listItem.description}</span>
                                      {listItem.subContractorId && <span className="text-[10px] text-muted-foreground uppercase font-black">{projectSubs.find(s => s.id === listItem.subContractorId)?.name}</span>}
                                  </div>
                                  <div className="flex gap-1">
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setItemPhotoTargetId(listItem.id); }}><Camera className="h-4 w-4" /></Button>
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveItem(listItem.id); }}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                      <FormLabel className="font-black text-xs uppercase text-muted-foreground">General Photos</FormLabel>
                      <div className="flex flex-wrap gap-3">
                          {photos.map((p, i) => (
                              <div key={i} className="relative w-24 h-24 group"><Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2" /></div>
                          ))}
                          <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsCameraOpen(true); }}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase tracking-tighter">Photo</span></Button>
                      </div>
                    </div>
                  </form>
              </Form>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 border-t bg-white">
            <Button type="button" className="w-full h-12 font-bold" onClick={() => setOpen(false)}>Done & Finish Editing</Button>
          </DialogFooter>
        </DialogContent>

        {/* Full-screen Camera Overlay - Explicitly outside the form tag */}
        {(isCameraOpen || itemPhotoTargetId !== null) && (
          <div className="fixed inset-0 z-[100] bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-end"><Button type="button" variant="secondary" onClick={closeCamera} className="rounded-full h-12 px-6 font-bold shadow-lg">Cancel</Button></div>
              <div className="flex items-center justify-center gap-8 mb-8">
                <Button type="button" variant="secondary" size="icon" className="rounded-full h-14 w-14 shadow-lg" onClick={toggleCamera}><RefreshCw className="h-7 w-7" /></Button>
                <Button type="button" size="lg" onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto} className="rounded-full h-20 w-20 bg-white hover:bg-white/90"><div className="h-14 w-14 rounded-full border-2 border-black/10" /></Button>
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
