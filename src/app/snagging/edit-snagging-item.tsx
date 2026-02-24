
'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
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
import { Pencil, Camera, Upload, X, Trash2, CheckCircle2, Circle, Plus, AlertTriangle, UserPlus, User, RefreshCw } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem, SubContractor } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
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
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

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

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects]);

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
    if (isCameraOpen || itemPhotoTargetId !== null) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, itemPhotoTargetId, facingMode]);

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
      const ts = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      context.font = 'bold 24px sans-serif';
      context.fillStyle = 'white';
      context.shadowColor = 'black';
      context.shadowBlur = 6;
      context.fillText(ts, canvas.width - context.measureText(ts).width - 20, canvas.height - 20);
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
    if (photo && itemPhotoTargetId) {
      setItems(prev => prev.map(i => {
        if (i.id === itemPhotoTargetId) {
          const field = i.status === 'closed' ? 'photos' : 'completionPhotos';
          return { ...i, [field]: [...(i[field] || []), photo] };
        }
        return i;
      }));
      setItemPhotoTargetId(null);
    }
  };

  const toggleCamera = () => setFacingMode(p => p === 'user' ? 'environment' : 'user');

  const onSubmit = (values: EditSnaggingListFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Persisting media changes...' });

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
          return { ...itm, photos: pDefects, completionPhotos: pFixed };
        }));

        const docRef = doc(db, 'snagging-items', item.id);
        const updates = { ...values, items: upItems, photos: upGeneral };
        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Snagging list updated.' });
        setOpen(false);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message || 'Failed to save.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /><span className="sr-only">Edit List</span></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Edit Snagging List</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-0">
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
                <FormLabel className="text-base font-semibold">List Items</FormLabel>
                <div className="space-y-3">
                    {items.map(listItem => (
                        <div key={listItem.id} className="p-3 border rounded-md bg-muted/10 group">
                            <div className="flex items-center justify-between">
                                <span className={cn("text-sm", listItem.status === 'closed' && "line-through text-muted-foreground")}>{listItem.description}</span>
                                <div className="flex gap-1 items-center">
                                    <Button type="button" variant="ghost" size="icon" className="text-primary" onClick={() => setItemPhotoTargetId(listItem.id)}><Camera className="h-4 w-4" /></Button>
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(items.filter(i => i.id !== listItem.id))}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            {(listItem.photos?.length || 0) > 0 && <div className="flex gap-2 mt-2">{listItem.photos?.map((p, idx) => <div key={idx} className="relative w-10 h-10"><Image src={p.url} alt="D" fill className="rounded object-cover border" /></div>)}</div>}
                        </div>
                    ))}
                </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <FormLabel>Reference Photos</FormLabel>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20"><Image src={p.url} alt="S" fill className="rounded-md object-cover" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>
                ))}
                <Button type="button" variant="outline" size="icon" className="w-20 h-20" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6" /></Button>
              </div>
              {(isCameraOpen || itemPhotoTargetId) && (
                <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                  <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto}>Capture</Button>
                    <Button type="button" variant="outline" size="sm" onClick={toggleCamera}><RefreshCw className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setIsCameraOpen(false); setItemPhotoTargetId(null); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </form>
        </Form>
        <DialogFooter className="mt-4 pt-4 border-t"><Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>{isPending ? 'Processing...' : 'Save Changes'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
