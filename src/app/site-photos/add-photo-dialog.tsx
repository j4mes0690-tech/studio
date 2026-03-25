
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
import { Camera, PlusCircle, Loader2, Save, Upload, X, Building2, MapPin, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Project, DistributionUser, Photo, SiteProgressPhoto } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';
import Image from 'next/image';
import { cn, scrollToFirstError } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [capturedPhoto, setCapturedPhoto] = useState<Photo | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const form = useForm<AddPhotoFormValues>({
    resolver: zodResolver(AddPhotoSchema),
    defaultValues: { projectId: '', areaId: 'none', description: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];

  const handleAutoSavePhoto = async (photo: Photo) => {
    const values = form.getValues();
    if (!values.projectId) {
        toast({ title: 'Project Required', description: 'Please select a project before taking photos to ensure they are assigned correctly.', variant: 'destructive' });
        return;
    }

    setIsSyncing(true);
    try {
        const blob = await dataUriToBlob(photo.url);
        const path = `site-progress/${values.projectId}/${Date.now()}.jpg`;
        const url = await uploadFile(storage, path, blob);
        const finalPhoto = { ...photo, url };

        if (activeDocId) {
            // Update existing draft
            await updateDoc(doc(db, 'site-photos', activeDocId), {
                photo: finalPhoto
            });
        } else {
            // Create new record
            const photoData: Omit<SiteProgressPhoto, 'id'> = {
                projectId: values.projectId,
                areaId: values.areaId === 'none' ? null : (values.areaId || null),
                description: values.description || '',
                photo: finalPhoto,
                createdAt: new Date().toISOString(),
                createdByEmail: currentUser.email.toLowerCase().trim()
            };
            const docRef = await addDoc(collection(db, 'site-photos'), photoData);
            setActiveDocId(docRef.id);
        }
        
        setCapturedPhoto(finalPhoto);
        toast({ title: 'Photo Synced', description: 'Visual record saved to cloud.' });
    } catch (err) {
        console.error(err);
        toast({ title: 'Sync Error', description: 'Photo captured but failed to reach cloud storage.', variant: 'destructive' });
    } finally {
        setIsSyncing(false);
    }
  };

  const onCapture = (photo: Photo) => {
    setCapturedPhoto(photo); // Immediate UI preview
    handleAutoSavePhoto(photo);
    setIsCameraOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUri = event.target?.result as string;
      const optimized = await optimizeImage(dataUri);
      const photo = { url: optimized, takenAt: new Date().toISOString() };
      setCapturedPhoto(photo);
      handleAutoSavePhoto(photo);
    };
    reader.readAsDataURL(file);
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
    if (!capturedPhoto || !activeDocId) {
        toast({ title: 'Incomplete', description: 'Capture a progress photo first.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        await updateDoc(doc(db, 'site-photos', activeDocId), {
          projectId: values.projectId,
          areaId: values.areaId === 'none' ? null : (values.areaId || null),
          description: values.description,
        });
        toast({ title: 'Progress Saved', description: 'Record finalized in gallery.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to finalize documentation.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setCapturedPhoto(null);
      setActiveDocId(null);
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
          className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-xl shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <DialogTitle>Document Progress</DialogTitle>
                        <DialogDescription>Record high-fidelity visual evidence.</DialogDescription>
                    </div>
                </div>
                {activeDocId && (
                    <Badge variant="secondary" className="animate-in fade-in zoom-in duration-300 font-mono text-[10px] h-6">
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3 w-3 mr-1.5 text-green-600" />}
                        AUTOSAVE ACTIVE
                    </Badge>
                )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="p-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstError())} className="space-y-6">
                        <div className="space-y-4">
                            <div className={cn(
                                "relative aspect-video rounded-xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center bg-muted/5 group",
                                capturedPhoto ? "border-primary/50" : "border-muted-foreground/20 hover:border-primary/30"
                            )}>
                                {capturedPhoto ? (
                                    <>
                                        <Image src={capturedPhoto.url} alt="Capture" fill className="object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button type="button" variant="secondary" size="sm" className="font-bold" onClick={() => setIsCameraOpen(true)}><Camera className="h-4 w-4 mr-2" /> Retake</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 p-8 text-center">
                                        <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                                            <Camera className="h-8 w-8 text-muted-foreground/40" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">No image captured</p>
                                            <p className="text-xs text-muted-foreground mt-1">First, choose a project, then capture documentation</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="outline" className="flex-1 h-11 gap-2 font-bold" onClick={() => setIsCameraOpen(true)} disabled={!selectedProjectId}>
                                    <Camera className="h-4 w-4" /> Camera
                                </Button>
                                <Button type="button" variant="outline" className="flex-1 h-11 gap-2 font-bold" onClick={() => fileInputRef.current?.click()} disabled={!selectedProjectId}>
                                    <Upload className="h-4 w-4" /> Gallery
                                </Button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="projectId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-primary" /> Project
                                        </FormLabel>
                                        <Select onValueChange={(v) => { field.onChange(v); form.setValue('areaId', 'none'); handleMetadataChange(); }} value={field.value}>
                                            <FormControl><SelectTrigger className="bg-background h-10"><SelectValue placeholder="Choose project" /></SelectTrigger></FormControl>
                                            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="areaId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 text-primary" /> Area / Plot
                                        </FormLabel>
                                        <Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value || 'none'} disabled={!selectedProjectId}>
                                            <FormControl><SelectTrigger className="bg-background h-10"><SelectValue placeholder="Choose location" /></SelectTrigger></FormControl>
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
                                    <FormControl><Input placeholder="e.g. Completed foundation pour..." {...field} className="h-10" onBlur={handleMetadataChange} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending || !capturedPhoto}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Progress
                        </Button>
                    </form>
                </Form>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture}
        title="Progress Documentation"
      />
    </>
  );
}
