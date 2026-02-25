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
import { PlusCircle, Camera, Upload, X, RefreshCw, ShieldCheck, Ruler } from 'lucide-react';
import type { Project, DistributionUser, Photo, SubContractor } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { generateReference } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const NewInformationRequestSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  requiredBy: z.string().optional(),
});

type NewInformationRequestFormValues = z.infer<typeof NewInformationRequestSchema>;

type NewInformationRequestProps = {
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
  currentUser: DistributionUser;
};

export function NewInformationRequest({ projects, distributionUsers, subContractors, currentUser }: NewInformationRequestProps) {
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

  const [photos, setPhotos] = useState<Photo[]>([]);

  const form = useForm<NewInformationRequestFormValues>({
    resolver: zodResolver(NewInformationRequestSchema),
    defaultValues: {
      projectId: '',
      description: '',
      assignedTo: [],
      requiredBy: undefined,
    },
  });

  const selectedProjectId = form.watch('projectId');

  const designers = useMemo(() => {
    return subContractors.filter(sub => sub.isDesigner);
  }, [subContractors]);

  const onSubmit = (values: NewInformationRequestFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Uploading', description: 'Persisting media items...' });

        // 1. Upload Photos
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `information-requests/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // Determine Prefix: CRFI for internal client, RFI for external designer
        // Check if any assignee is an external designer
        const hasExternalDesigner = designers.some(d => values.assignedTo.includes(d.email.toLowerCase().trim()));
        const prefix = hasExternalDesigner ? 'RFI' : 'CRFI';

        const requestData = {
          reference: generateReference(prefix),
          projectId: values.projectId,
          description: values.description,
          assignedTo: values.assignedTo.map(e => e.toLowerCase().trim()),
          raisedBy: currentUser.email.toLowerCase().trim(),
          photos: uploadedPhotos,
          requiredBy: values.requiredBy || null,
          status: 'open',
          messages: [],
          createdAt: new Date().toISOString(),
        };

        const colRef = collection(db, 'information-requests');
        addDoc(colRef, requestData)
          .then(() => {
            toast({ title: 'Success', description: `${prefix} logged successfully.` });
            setOpen(false);
          })
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: colRef.path,
              operation: 'create',
              requestResourceData: requestData,
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
    if (!open) {
      setIsCameraOpen(false);
      setPhotos([]);
      form.reset();
    }
  }, [open, form]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Information Request (CRFI / RFI)</DialogTitle>
          <DialogDescription>
            Record a technical query. Internal assignments generate a CRFI, while Designers generate an RFI.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Inquiry Details</FormLabel>
                    <VoiceInput onResult={(text) => form.setValue('description', text)} />
                  </div>
                  <FormControl>
                    <Textarea placeholder="What information is required? Be specific." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requiredBy"
              render={({ field }) => (
                <DatePicker field={field} label="Required By (Optional)" />
              )}
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
                        {designers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8">No Designers registered in system.</p>}
                    </ScrollArea>
                </FormItem>
            </div>

            <div className="space-y-4">
              <FormLabel>Visual Context</FormLabel>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group">
                      <Image src={p.url} alt="Reference" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
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
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    Array.from(files).forEach(f => {
                      const reader = new FileReader();
                      reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                      reader.readAsDataURL(f);
                    });
                  }} />
                </div>
              )}
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Processing...' : 'Save & Log Request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
