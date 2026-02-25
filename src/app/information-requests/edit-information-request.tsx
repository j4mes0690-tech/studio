
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
import { Pencil, Camera, Upload, X, RefreshCw, ShieldCheck, Ruler, FileIcon, FileText } from 'lucide-react';
import type { Project, InformationRequest, DistributionUser, Photo, SubContractor, FileAttachment } from '@/lib/types';
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [files, setFiles] = useState<FileAttachment[]>(item.files || []);

  const subsQuery = useMemo(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

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

  const selectedProjectId = form.watch('projectId');

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const availableInternalUsers = useMemo(() => {
    if (!selectedProject) return [];
    const assignedEmails = selectedProject.assignedUsers || [];
    return distributionUsers.filter(u => 
      assignedEmails.some(email => email.toLowerCase().trim() === u.email.toLowerCase().trim())
    );
  }, [selectedProject, distributionUsers]);

  const availableDesigners = useMemo(() => {
    if (!selectedProject || !subContractors) return [];
    const assignedSubIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => sub.isDesigner && assignedSubIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: EditInformationRequestFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Uploading documentation...' });

        // 1. Upload Photos
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `information-requests/photos/${item.id}-${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // 2. Upload Files
        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `information-requests/files/${item.id}-${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const updates = {
          projectId: values.projectId,
          description: values.description,
          assignedTo: values.assignedTo.map(e => e.toLowerCase().trim()),
          photos: uploadedPhotos,
          files: uploadedFiles,
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
        toast({ title: 'Error', description: 'Failed to upload documentation.', variant: 'destructive' });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    
    Array.from(selectedFiles).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: 'File Too Large', description: `${f.name} exceeds 10MB limit.`, variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (re) => {
        setFiles(prev => [...prev, {
          name: f.name,
          type: f.type,
          size: f.size,
          url: re.target?.result as string
        }]);
      };
      reader.readAsDataURL(f);
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
      setFiles(item.files || []);
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
          <DialogDescription>Only assigned project members can be recipients.</DialogDescription>
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
                  <Select onValueChange={(val) => { field.onChange(val); form.setValue('assignedTo', []); }} value={field.value}>
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
                        <FormLabel>Project Internal Contacts (CRFI)</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {availableInternalUsers.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-8">No staff members assigned to this project.</p>
                        ) : availableInternalUsers.map((u) => (
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
                        <FormLabel>Project Designers (RFI)</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {availableDesigners.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-8">No designers assigned to this project.</p>
                        ) : availableDesigners.map((sub) => (
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
              <FormLabel>Documentation & Photos</FormLabel>
              <div className="space-y-4">
                {(photos.length > 0 || files.length > 0) && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {photos.map((photo, index) => (
                        <div key={`p-${index}`} className="relative group">
                          <Image src={photo.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                          <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={`f-${i}`} className="flex items-center justify-between p-2 rounded-md border bg-muted/30 group">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="text-xs truncate font-medium">{f.name}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isCameraOpen ? (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full aspect-video bg-muted rounded-md object-cover" autoPlay muted playsInline />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={takePhoto}>Capture</Button>
                      <Button type="button" variant="outline" size="sm" onClick={toggleCamera}><RefreshCw className="h-4 w-4" /></Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Take Photo</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Photos</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileText className="mr-2 h-4 w-4" />Files</Button>
                    
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                      const selected = e.target.files;
                      if (!selected) return;
                      Array.from(selected).forEach(f => {
                        const reader = new FileReader();
                        reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                        reader.readAsDataURL(f);
                      });
                    }} />
                    <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} />
                  </div>
                )}
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter><Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
