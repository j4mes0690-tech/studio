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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Camera, Upload, X, RefreshCw, ShieldCheck, Ruler, FileIcon, FileText, Users2, Loader2, Save, Send } from 'lucide-react';
import type { Project, InformationRequest, DistributionUser, Photo, SubContractor, FileAttachment } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePicker } from '@/components/date-picker';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { Separator } from '@/components/ui/separator';
import { VoiceInput } from '@/components/voice-input';
import { sendInformationRequestEmailAction } from './actions';
import { getPartnerEmails, getProjectInitials } from '@/lib/utils';
import { generateInformationRequestPDF } from '@/lib/pdf-utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EditInformationRequestSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().optional().default(''),
  assignedTo: z.array(z.string()).min(1, 'A recipient must be assigned.'),
  requiredBy: z.string().optional(),
  status: z.enum(['draft', 'open', 'closed']).default('open'),
});

type EditInformationRequestFormValues = z.infer<typeof EditInformationRequestSchema>;

export function EditInformationRequest({ item, projects, distributionUsers, open: externalOpen, onOpenChange: setExternalOpen }: { 
  item: InformationRequest; 
  projects: Project[]; 
  distributionUsers: DistributionUser[]; 
  open?: boolean; 
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

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

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const form = useForm<EditInformationRequestFormValues>({
    resolver: zodResolver(EditInformationRequestSchema),
    defaultValues: {
      id: item.id,
      projectId: item.projectId,
      description: item.description || '',
      assignedTo: item.assignedTo || [],
      requiredBy: item.requiredBy,
      status: item.status,
    },
  });

  const selectedProjectId = form.watch('projectId');

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  const availableInternalUsers = useMemo(() => {
    if (!selectedProject) return [];
    const assignedEmails = selectedProject.assignedUsers || [];
    return (distributionUsers || []).filter(u => 
      assignedEmails.some(email => email.toLowerCase().trim() === u.email.toLowerCase().trim())
    );
  }, [selectedProject, distributionUsers]);

  const availableExternalPartners = useMemo(() => {
    if (!selectedProject || !subContractors) return [];
    const assignedSubIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedSubIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: EditInformationRequestFormValues) => {
    if (values.status === 'open') {
      let hasError = false;
      if (!values.description || values.description.trim().length < 10) {
        form.setError('description', { message: 'Inquiry details must be at least 10 characters to formally log.' });
        hasError = true;
      }
      if (!values.assignedTo || values.assignedTo.length === 0) {
        form.setError('assignedTo', { message: 'A recipient must be assigned to log this request.' });
        hasError = true;
      }
      if (hasError) return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Generating PDF and updating record...' });

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

        const targetEmail = values.assignedTo[0];
        const updates: any = {
          projectId: values.projectId,
          description: values.description || '',
          assignedTo: (values.assignedTo || []).map(e => e.toLowerCase().trim()),
          photos: uploadedPhotos,
          files: uploadedFiles,
          requiredBy: values.requiredBy || null,
          status: values.status,
        };

        const docRef = doc(db, 'information-requests', values.id);
        
        await updateDoc(docRef, updates)
          .then(async () => {
            // Trigger distribution if transitioning to open
            if (values.status === 'open' && item.status === 'draft') {
                const sub = availableExternalPartners.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
                const recipientEmails = new Set<string>();
                recipientEmails.add(targetEmail.toLowerCase().trim());

                if (sub) {
                    const partnerUsers = getPartnerEmails(sub.id, subContractors || [], distributionUsers);
                    partnerUsers.forEach(e => recipientEmails.add(e));
                }

                // Generate PDF for attachment
                const assignedToNames = values.assignedTo.map(email => (distributionUsers || []).find(u => u.email === email)?.name || email);
                const pdf = await generateInformationRequestPDF({ ...item, ...updates }, selectedProject, assignedToNames);
                const pdfBase64 = pdf.output('datauristring').split(',')[1];

                await sendInformationRequestEmailAction({
                    emails: Array.from(recipientEmails),
                    projectName: selectedProject?.name || 'Project',
                    reference: item.reference,
                    description: values.description,
                    raisedBy: (distributionUsers || []).find(u => u.email === item.raisedBy)?.name || item.raisedBy,
                    requestId: item.id,
                    pdfBase64,
                    fileName: `RFI-${item.reference}.pdf`
                });
            }

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
            throw error;
          });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to process request update.', variant: 'destructive' });
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
        description: item.description || '',
        assignedTo: item.assignedTo || [],
        requiredBy: item.requiredBy,
        status: item.status,
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

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1600;
      canvas.height = 1600 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawUri = canvas.toDataURL('image/jpeg', 0.9);
      const optimizedUri = await optimizeImage(rawUri);
      setPhotos(prev => [...prev, { url: optimizedUri, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const submissionStatus = form.watch('status');

  return (
    <>
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
            <DialogDescription>Modify inquiry details or assigned recipients.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...form.register('id')} />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To (Recipient)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange([val.split(':')[1]])} 
                        value={field.value?.[0] ? (
                          availableInternalUsers.some(u => u.email === field.value[0]) 
                            ? `staff:${field.value[0]}` 
                            : `partner:${field.value[0]}`
                        ) : ""}
                        disabled={!selectedProjectId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project recipient" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="flex items-center gap-2 text-primary">
                              <ShieldCheck className="h-3 w-3" /> Project Staff
                            </SelectLabel>
                            {availableInternalUsers.map(u => (
                              <SelectItem key={`staff-${u.id}`} value={`staff:${u.email}`}>{u.name} ({u.email})</SelectItem>
                            ))}
                            {availableInternalUsers.length === 0 && (
                              <div className="p-2 text-[10px] text-muted-foreground italic">No staff assigned to this project.</div>
                            )}
                          </SelectGroup>
                          <Separator className="my-1" />
                          <SelectGroup>
                            <SelectLabel className="flex items-center gap-2 text-accent">
                              <Users2 className="h-3 w-3" /> Trade Partners
                            </SelectLabel>
                            {availableExternalPartners.map(s => (
                              <SelectItem key={`partner-${s.id}`} value={`partner:${s.email}`}>{s.name}</SelectItem>
                            ))}
                            {availableExternalPartners.length === 0 && (
                              <div className="p-2 text-[10px] text-muted-foreground italic">No partners assigned to this project.</div>
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Inquiry</FormLabel>
                      <VoiceInput onResult={(text) => form.setValue('description', text)} />
                    </div>
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
                </div>
              </div>
              
              <canvas ref={canvasRef} className="hidden" />
              <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button 
                  type="submit" 
                  variant="outline" 
                  className="w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() => form.setValue('status', 'draft')}
                >
                  {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                  Save as Draft
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:flex-1" 
                  disabled={isPending}
                  onClick={() => form.setValue('status', 'open')}
                >
                  {isPending && submissionStatus === 'open' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 animate-spin mr-2" />}
                  Save & Log Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Camera Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIsCameraOpen(false)} className="rounded-full h-12 px-6 font-bold shadow-lg">Cancel</Button>
            </div>
            <div className="flex items-center justify-center gap-8 mb-8">
              <Button variant="secondary" size="icon" className="rounded-full h-14 w-14 shadow-lg" onClick={toggleCamera}>
                <RefreshCw className="h-7 w-7" />
              </Button>
              <Button size="lg" onClick={takePhoto} className="rounded-full h-20 w-20 bg-white hover:bg-white/90">
                <div className="h-14 w-14 rounded-full border-2 border-black/10" />
              </Button>
              <div className="w-14" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
