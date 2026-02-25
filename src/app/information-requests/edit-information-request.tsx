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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Camera, Upload, X, RefreshCw, ShieldCheck, Ruler } from 'lucide-react';
import type { Project, InformationRequest, DistributionUser, Photo, SubContractor } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useStorage, useCollection } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { Separator } from '@/components/ui/separator';

const EditInformationRequestSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  requiredBy: z.string().optional(),
});

type EditInformationRequestFormValues = z.infer<typeof EditInformationRequestSchema>;

type EditInformationRequestProps = {
  item: InformationRequest;
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function EditInformationRequest({ item, projects, distributionUsers }: EditInformationRequestProps) {
  const [open, setOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const designers = useMemo(() => {
    return (subContractors || []).filter(sub => sub.isDesigner);
  }, [subContractors]);

  const form = useForm<EditInformationRequestFormValues>({
    resolver: zodResolver(EditInformationRequestSchema),
    defaultValues: {
      id: item.id,
      projectId: item.projectId,
      description: item.description,
      assignedTo: item.assignedTo || [],
      requiredBy: item.requiredBy,
    },
  });

  const onSubmit = (values: EditInformationRequestFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Uploading new photos to cloud storage...' });

        // 1. Upload Photos
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `information-requests/${item.id}-${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const updates = {
          projectId: values.projectId,
          description: values.description,
          assignedTo: values.assignedTo.map(e => e.toLowerCase().trim()),
          photos: uploadedPhotos,
          requiredBy: values.requiredBy || null,
        };

        const docRef = doc(db, 'information-requests', values.id);
        
        updateDoc(docRef, updates)
          .then(() => {
            toast({ title: 'Success', description: 'Information request updated.' });
            setOpen(false);
          })
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to upload photos.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (open) {
      form.reset({
        id: item.id,
        projectId: item.projectId,
        description: item.description,
        assignedTo: item.assignedTo || [],
        requiredBy: item.requiredBy,
      });
      setPhotos(item.photos || []);
    } else {
      setIsCameraOpen(false);
    }
  }, [open, form, item]);

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
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [isCameraOpen, facingMode]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit Request</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit Request</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Information Request</DialogTitle>
          <DialogDescription>Update metadata and assignments.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...form.register('id')} />
            
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inquiry</FormLabel>
                  <FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiredBy"
              render={({ field }) => <DatePicker field={field} label="Required By" />}
            />

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormItem>
                    <div className='flex items-center gap-2 mb-2'>
                        <ShieldCheck className='h-4 w-4 text-primary' />
                        <FormLabel>Internal Contacts (CRFI)</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {distributionUsers.map((u) => (
                        <FormField
                            key={u.id}
                            control={form.control}
                            name="assignedTo"
                            render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(u.email)}
                                    onCheckedChange={(c) => {
                                    const curr = field.value || [];
                                    field.onChange(c ? [...curr, u.email] : curr.filter(v => v !== u.email));
                                    }}
                                />
                                </FormControl>
                                <div className="flex flex-col leading-none">
                                    <FormLabel className="text-xs font-semibold">{u.name}</FormLabel>
                                    <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                </div>
                            </FormItem>
                            )}
                        />
                        ))}
                    </ScrollArea>
                </FormItem>

                <FormItem>
                    <div className='flex items-center gap-2 mb-2'>
                        <Ruler className='h-4 w-4 text-accent' />
                        <FormLabel>External Designers (RFI)</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {designers.map((sub) => (
                        <FormField
                            key={sub.id}
                            control={form.control}
                            name="assignedTo"
                            render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(sub.email)}
                                    onCheckedChange={(c) => {
                                    const curr = field.value || [];
                                    field.onChange(c ? [...curr, sub.email] : curr.filter(v => v !== sub.email));
                                    }}
                                />
                                </FormControl>
                                <div className="flex flex-col leading-none">
                                    <FormLabel className="text-xs font-semibold">{sub.name}</FormLabel>
                                    <span className="text-[10px] text-muted-foreground">{sub.email}</span>
                                </div>
                            </FormItem>
                            )}
                        />
                        ))}
                    </ScrollArea>
                </FormItem>
            </div>

            <div className="space-y-4">
              <FormLabel>Photos</FormLabel>
              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <Image src={photo.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removePhoto(index)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
              {isCameraOpen ? (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full aspect-video bg-muted rounded-md object-cover" autoPlay muted playsInline />
                  <div className="flex gap-2">
                    <Button type="button" onClick={takePhoto}>Capture</Button>
                    <Button type="button" variant="outline" size="icon" onClick={toggleCamera}><RefreshCw className="h-4 w-4" /></Button>
                    <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Take Photo</Button>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
                </div>
              )}
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter><Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
