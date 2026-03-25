'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, PlusCircle, Loader2, Save, Upload, X, Building2, MapPin, Sparkles, CheckCircle2, Maximize2 } from 'lucide-react';
import type { Project, DistributionUser, Photo, SiteProgressPhoto } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';
import Image from 'next/image';
import { cn, scrollToFirstError } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/image-lightbox';

const AddPhotoSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional().nullable(),
  description: z.string().optional().default(''),
});

type AddPhotoFormValues = z.infer<typeof AddPhotoSchema>;

export function AddPhotoDialog({ projects, currentUser }: { projects: Project[], currentUser: DistributionUser }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Synchronization references to prevent duplicate records during rapid multi-capture
  const activeIdRef = useRef<string | null>(null);
  const creationPromiseRef = useRef<Promise<string> | null>(null);

  const form = useForm<AddPhotoFormValues>({
    resolver: zodResolver(AddPhotoSchema),
    defaultValues: { projectId: '', areaId: 'none', description: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];

  /**
   * ensureRecordCreated - Robust initialization of the progress record.
   * Handles race conditions by returning a pending creation promise if already in flight.
   */
  const ensureRecordCreated = async (values: AddPhotoFormValues): Promise<string | null> => {
    if (activeIdRef.current) return activeIdRef.current;
    if (creationPromiseRef.current) return creationPromiseRef.current;

    creationPromiseRef.current = (async () => {
        const photoData: Omit<SiteProgressPhoto, 'id'> = {
            projectId: values.projectId,
            areaId: values.areaId === 'none' ? null : (values.areaId || null),
            description: values.description || '',
            photos: [], // Start with empty list, images are added via arrayUnion immediately after
            createdAt: new Date().toISOString(),
            createdByEmail: currentUser.email.toLowerCase().trim()
        };
        const docRef = await addDoc(collection(db, 'site-photos'), photoData);
        activeIdRef.current = docRef.id;
        setActiveDocId(docRef.id);
        return docRef.id;
    })();

    return creationPromiseRef.current;
  };

  const handleAutoSavePhoto = async (photo: Photo) => {
    const values = form.getValues();
    if (!values.projectId) {
        toast({ title: 'Project Required', description: 'Please select a project before documenting progress.', variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    try {
        const diaryId = await ensureRecordCreated(values);
        if (!diaryId) return;

        const blob = await dataUriToBlob(photo.url);
        const path = `site-progress/${diaryId}/${Date.now()}.jpg`;
        const url = await uploadFile(storage, path, blob);
        const finalPhoto = { ...photo, url };

        await updateDoc(doc(db, 'site-photos', diaryId), {
            photos: arrayUnion(finalPhoto)
        });
        
        setPhotos(prev => [...prev, finalPhoto]);
        toast({ title: 'Photo Synced', description: 'Visual record saved.' });
    } catch (err) {
        console.error(err);
        toast({ title: 'Sync Error', description: 'Failed to upload documentation.', variant: 'destructive' });
    } finally {
        setIsSyncing(false);
    }
  };

  const removePhoto = async (idx: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== idx);
    setPhotos(updatedPhotos);
    if (activeDocId) {
        await updateDoc(doc(db, 'site-photos', activeDocId), {
            photos: updatedPhotos
        });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        const optimized = await optimizeImage(dataUri);
        handleAutoSavePhoto({ url: optimized, takenAt: new Date().toISOString() });
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const handleMetadataChange = () => {
    if (activeDocId) {
        const values = form.getValues();
        updateDoc(doc(db, 'site-photos', activeDocId), {
            projectId: values.projectId,
            areaId: values.areaId === 'none' ? null : (values.areaId || null),
            description: values.description || '',
        });
    }
  };

  const onSubmit = (values: AddPhotoFormValues) => {
    if (photos.length === 0 || !activeDocId) {
        toast({ title: 'Incomplete', description: 'Capture at least one progress photo.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        await updateDoc(doc(db, 'site-photos', activeDocId), {
          projectId: values.projectId,
          areaId: values.areaId === 'none' ? null : (values.areaId || null),
          description: values.description,
        });
        toast({ title: 'Progress Saved', description: 'Records finalized.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to finalize documentation.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setActiveDocId(null);
      activeIdRef.current = null;
      creationPromiseRef.current = null;
      setIsSyncing(false);
      form.reset();
    }
  }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 font-bold shadow-lg shadow-primary/20">
            <Camera className="h-4 w-4" />
            Capture Progress
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-xl shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-4 md:p-6 bg-primary/5 border-b shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <DialogTitle>Document Progress</DialogTitle>
                        <DialogDescription>Capture visual evidence of site status.</DialogDescription>
                    </div>
                </div>
                {activeDocId && (
                    <Badge variant="secondary" className="animate-in fade-in zoom-in font-mono text-[10px] h-6">
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5 text-green-600" />}
                        SYNCED
                    </Badge>
                )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 space-y-6 pb-24">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 h-12 gap-2 font-bold" onClick={() => setIsCameraOpen(true)} disabled={!selectedProjectId}>
                            <Camera className="h-5 w-5 text-primary" /> Take Photo
                        </Button>
                        <Button type="button" variant="outline" className="flex-1 h-12 gap-2 font-bold" onClick={() => fileInputRef.current?.click()} disabled={!selectedProjectId}>
                            <Upload className="h-5 w-5 text-primary" /> Upload
                        </Button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-[120px] bg-muted/5 p-4 rounded-xl border-2 border-dashed border-muted">
                        {photos.map((p, i) => (
                            <div key={i} className="relative aspect-video rounded-lg overflow-hidden border shadow-sm group">
                                <Image src={p.url} alt="Site" fill className="object-cover cursor-pointer" onClick={() => setViewingPhoto(p)} />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 className="h-4 w-4 text-white" />
                                </div>
                                <button type="button" className="absolute top-1 right-1 bg-destructive text-white h-5 w-5 rounded-full flex items-center justify-center shadow-lg" onClick={(e) => { e.stopPropagation(); removePhoto(i); }}>
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        {photos.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground/40 py-8">
                                <Camera className="h-8 w-8 mb-2" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No photos captured</p>
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                <Form {...form}>
                    <form className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-primary" /> Project
                                    </FormLabel>
                                    <Select onValueChange={(v) => { field.onChange(v); form.setValue('areaId', 'none'); handleMetadataChange(); }} value={field.value}>
                                        <FormControl><SelectTrigger className="bg-background h-11"><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <MapPin className="h-3.5 w-3.5 text-primary" /> Area / Plot
                                    </FormLabel>
                                    <Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value || 'none'} disabled={!selectedProjectId}>
                                        <FormControl><SelectTrigger className="bg-background h-11"><SelectValue placeholder="Site Wide" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Site Wide / General</SelectItem>
                                            {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Activity Description</FormLabel>
                                <FormControl><Input placeholder="e.g. Reinforced concrete pour complete..." {...field} className="h-11" onBlur={handleMetadataChange} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <Button type="button" onClick={form.handleSubmit(onSubmit)} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending || photos.length === 0}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Progress
                        </Button>
                    </form>
                </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => handleAutoSavePhoto(photo)}
        title="Progress Documentation"
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
