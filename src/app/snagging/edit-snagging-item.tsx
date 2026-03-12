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
import { 
  Pencil, 
  Camera, 
  Upload, 
  X, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Plus, 
  UserPlus, 
  User, 
  RefreshCw, 
  Loader2, 
  Save, 
  History, 
  Eye, 
  FileSearch,
  Check
} from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem, SubContractor, SnaggingHistoryRecord } from '@/lib/types';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/client-date';
import { ImageLightbox } from '@/components/image-lightbox';

const EditSnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type EditSnaggingListFormValues = z.infer<typeof EditSnaggingListSchema>;

type EditSnaggingItemProps = {
  item: SnaggingItem;
  projects: Project[];
  subContractors: SubContractor[];
};

export function EditSnaggingItem({ item, projects, subContractors }: EditSnaggingItemProps) {
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
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

  // Version History Fetching
  const historyQuery = useMemoFirebase(() => {
    if (!db || !item.id) return null;
    return query(collection(db, 'snagging-items', item.id, 'history'), orderBy('timestamp', 'desc'));
  }, [db, item.id]);
  const { data: history } = useCollection<SnaggingHistoryRecord>(historyQuery);

  // Snapshot Viewer State
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const form = useForm<EditSnaggingListFormValues>({
    resolver: zodResolver(EditSnaggingListSchema),
    defaultValues: {
      projectId: item.projectId,
      areaId: item.areaId || '',
      title: item.title || '',
      description: item.description || '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  const selectedSub = useMemo(() => projectSubs.find(s => s.id === pendingSubId), [projectSubs, pendingSubId]);

  useEffect(() => {
    if (selectedProjectId) {
      setAreas(selectedProject?.areas || []);
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (open) {
      form.reset({
        projectId: item.projectId,
        areaId: item.areaId || '',
        title: item.title || '',
        description: item.description || '',
      });
      setPhotos(item.photos || []);
      setItems(item.items || []);
      setPendingItemPhotos([]);
    }
  }, [open, item, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetId !== null) getCameraPermission();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetId, facingMode]);

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
    const photo = capturePhoto();
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = () => {
    const photo = capturePhoto();
    if (photo) {
      if (itemPhotoTargetId) {
        setItems(prev => prev.map(i => {
          if (i.id === itemPhotoTargetId) {
            const field = i.status === 'closed' ? 'completionPhotos' : 'photos';
            return { ...i, [field]: [...(i[field] || []), photo] };
          }
          return i;
        }));
        setItemPhotoTargetId(null);
      } else {
        setPendingItemPhotos(prev => [...prev, photo]);
        setIsItemCameraOpen(false);
      }
    }
  };

  const toggleCamera = () => setFacingMode(p => p === 'user' ? 'environment' : 'user');

  const onSubmit = (values: EditSnaggingListFormValues) => {
    startTransition(async () => {
      try {
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
          const pFixed = await Promise.all((itm.completionPhotos || []).map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const b = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/items/${itm.id}-fixed-${i}.jpg`, b);
              return { ...p, url };
            }
            return p;
          }));
          return { ...itm, photos: pDefects, completionPhotos: pFixed, subContractorId: itm.subContractorId || null };
        }));

        const docRef = doc(db, 'snagging-items', item.id);
        const updates = { 
          projectId: values.projectId,
          areaId: values.areaId || null,
          title: values.title,
          description: values.description || null,
          items: upItems, 
          photos: upGeneral 
        };
        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        // Record History
        const historyCol = collection(db, 'snagging-items', item.id, 'history');
        const closed = upItems.filter(i => i.status === 'closed').length;
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: 'System User', 
          items: upItems,
          totalCount: upItems.length,
          closedCount: closed,
          summary: 'List updated via editor'
        });

        toast({ title: 'Success', description: 'Snagging list and version history updated.' });
        setOpen(false);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to save.', variant: 'destructive' });
      }
    });
  };

  const handleAddItem = () => {
    if (newItemText.trim() || pendingItemPhotos.length > 0) {
      setItems([...items, { 
        id: `item-${Date.now()}`, 
        description: newItemText.trim(), 
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /><span className="sr-only">Edit List</span></Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-6 pb-0 shrink-0"><DialogTitle>Edit Snagging List</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 px-6">
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="projectId" render={({ field }) => (
                          <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                      )} />
                      <FormField control={form.control} name="areaId" render={({ field }) => (
                          <FormItem><FormLabel>Area</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}<Separator className="my-1" /><SelectItem value="other">Other / Not Listed</SelectItem></SelectContent></FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  
                  <Separator />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <FormLabel className="text-base font-semibold">Defect Items</FormLabel>
                                <VoiceInput onResult={(text) => setNewItemText(text)} />
                            </div>
                            
                            <div className="flex gap-2 items-end">
                                <Input 
                                    placeholder="Add new defect..." 
                                    value={newItemText} 
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                                />
                                <div className="flex gap-1">
                                  <Select value={pendingSubId || 'unassigned'} onValueChange={v => setPendingSubId(v === 'unassigned' ? undefined : v)}>
                                      <SelectTrigger className={cn("px-2 flex items-center gap-2 border-none h-11 transition-all", pendingSubId ? "w-auto min-w-[40px]" : "w-10 justify-center")}>
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
                                  <Button type="button" variant="outline" size="icon" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-4 w-4" /></Button>
                                  <Button type="button" onClick={handleAddItem} size="icon"><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>

                            {/* Pending Previews */}
                            {pendingItemPhotos.length > 0 && (
                              <div className="flex gap-2 p-3 bg-muted/20 rounded-xl border border-dashed animate-in fade-in duration-300">
                                {pendingItemPhotos.map((p, idx) => (
                                  <div key={idx} className="relative w-16 h-12">
                                    <Image src={p.url} alt="Pre" fill className="rounded-md object-cover border" />
                                    <button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 shadow-sm" onClick={() => setPendingItemPhotos(prev => prev.filter((_, i) => i !== idx))}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex items-center text-[10px] text-muted-foreground italic pl-2">
                                  {pendingItemPhotos.length} photo(s) ready
                                </div>
                              </div>
                            )}

                            <div className="space-y-3">
                                {items.map((listItem, idx) => {
                                    const sub = subContractors?.find(s => s.id === listItem.subContractorId);
                                    return (
                                        <div key={listItem.id} className="p-3 border rounded-md bg-muted/10 group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                    <span className={cn("text-sm font-medium", listItem.status === 'closed' && "line-through text-muted-foreground")}>{listItem.description}</span>
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
                                                <div className="flex gap-1 items-center shrink-0">
                                                    <Button type="button" variant="ghost" size="icon" className="text-primary h-8 w-8" onClick={() => setItemPhotoTargetId(listItem.id)}><Camera className="h-4 w-4" /></Button>
                                                    <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setItems(items.filter(i => i.id !== listItem.id))}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                            {(listItem.photos?.length || 0) > 0 && <div className="flex gap-2 mt-2">{listItem.photos?.map((p, pIdx) => <div key={pIdx} className="relative w-10 h-10"><Image src={p.url} alt="D" fill className="rounded object-cover border" /></div>)}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2">
                          <FormLabel>Reference Photos</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {photos.map((p, i) => (
                              <div key={i} className="relative w-20 h-20 group">
                                <Image src={p.url} alt="S" fill className="rounded-md object-cover" />
                                <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="icon" className="w-20 h-20 border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6" /></Button>
                          </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                            <History className="h-4 w-4 text-primary" />
                            <span>Version & Snapshot History</span>
                        </div>
                        <ScrollArea className="h-[400px] rounded-lg border bg-muted/5 p-4 shadow-inner">
                            <div className="space-y-4">
                                {history && history.length > 0 ? history.map((record, idx) => (
                                    <div 
                                        key={record.id} 
                                        className="relative pl-4 border-l-2 border-primary/20 pb-4 last:pb-0 cursor-pointer group/hist transition-all hover:bg-white rounded-r-md hover:shadow-sm"
                                        onClick={() => setViewingHistoryRecord(record)}
                                    >
                                        <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase text-primary tracking-tighter">Version {history.length - idx}</span>
                                                    {idx === 0 && (
                                                      <Badge variant="secondary" className="h-4 px-1.5 text-[8px] bg-green-100 text-green-800 border-green-200 font-black">
                                                        CURRENT
                                                      </Badge>
                                                    )}
                                                    <Eye className="h-3.5 w-3.5 text-primary opacity-0 group-hover/hist:opacity-100 transition-opacity" />
                                                </div>
                                                <span className="text-[9px] text-muted-foreground font-medium"><ClientDate date={record.timestamp} /></span>
                                            </div>
                                            <p className="text-xs font-semibold text-foreground line-clamp-1">{record.summary}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-bold border-green-200 bg-green-50 text-green-700">
                                                    <Check className="h-2 w-2 mr-1" /> {record.closedCount}/{record.totalCount} points
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center gap-2 opacity-40">
                                        <History className="h-8 w-8" />
                                        <p className="text-[10px] font-bold uppercase">No Snapshots Yet</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button variant="ghost" className="font-bold text-muted-foreground order-last sm:order-first" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isPending} className="w-full sm:flex-1 h-12 font-bold gap-2">
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Snapshot & Changes
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              <canvas ref={canvasRef} className="hidden" />
            </form>
          </Form>
        </DialogContent>

        {/* Unified Full-Screen Camera Overlay */}
        {(isCameraOpen || isItemCameraOpen || itemPhotoTargetId !== null) && (
          <div className="fixed inset-0 z-[100] bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <div className="flex justify-end">
                <Button 
                  variant="secondary" 
                  onClick={() => { 
                    setIsCameraOpen(false); 
                    setIsItemCameraOpen(false);
                    setItemPhotoTargetId(null); 
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
      </Dialog>

      {/* Snapshot Details Viewer */}
      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0 shrink-0">
                  <div className='flex items-center gap-3 mb-1'>
                      <div className='bg-primary/10 p-2 rounded-lg text-primary'>
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

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
