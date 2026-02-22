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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Camera, Upload, X } from 'lucide-react';
import type { Project, DistributionUser, Photo } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/date-picker';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
};

export function NewInformationRequest({ projects, distributionUsers }: NewInformationRequestProps) {
  const [open, setOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();
  const { toast } = useToast();
  const db = useFirestore();
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

  const onSubmit = (values: NewInformationRequestFormValues) => {
    startTransition(async () => {
      // IDs are emails in the system
      const assignedEmails = distributionUsers
        .filter(u => values.assignedTo.includes(u.id))
        .map(u => u.email);

      const requestData = {
        projectId: values.projectId,
        description: values.description,
        assignedTo: assignedEmails,
        photos: photos,
        requiredBy: values.requiredBy || null,
        status: 'open',
        messages: [],
        createdAt: new Date().toISOString(),
      };

      const colRef = collection(db, 'information-requests');
      addDoc(colRef, requestData)
        .then(() => {
          toast({ title: 'Success', description: 'Information request logged.' });
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
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [isCameraOpen]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log New Information Request</DialogTitle>
          <DialogDescription>
            Record a request for information and assign it to a team member.
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
                  <FormLabel>Information Requested</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Updated floor plans for level 3..." className="min-h-[120px]" {...field} />
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

            <FormItem>
              <FormLabel>Assign To</FormLabel>
              <ScrollArea className="h-40 rounded-md border p-4">
                {distributionUsers.map((u) => (
                  <FormField
                    key={u.id}
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(u.id)}
                            onCheckedChange={(c) => {
                              const curr = field.value || [];
                              field.onChange(c ? [...curr, u.id] : curr.filter(v => v !== u.id));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{u.name}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </ScrollArea>
            </FormItem>

            <div className="space-y-4">
              <FormLabel>Photos</FormLabel>
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
                    <Button type="button" onClick={takePhoto}>Take Photo</Button>
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
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Request'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
