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
import { PlusCircle, Camera, Upload, X, RefreshCw, FileIcon, FileText, Users2, Loader2 } from 'lucide-react';
import type { Project, DistributionUser, Photo, SubContractor, FileAttachment, Instruction } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference } from '@/lib/utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const NewInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().optional().default(''),
  externalRecipient: z.string().optional().default(''),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

type NewInstructionProps = {
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
  allInstructions: Instruction[];
};

export function NewInstruction({ projects, distributionUsers, subContractors, allInstructions }: NewInstructionProps) {
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
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'issued'>('issued');

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);

  const form = useForm<NewInstructionFormValues>({
    resolver: zodResolver(NewInstructionSchema),
    defaultValues: {
      projectId: '',
      originalText: '',
      externalRecipient: '',
    },
  });

  const selectedProjectId = form.watch('projectId');

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [selectedProjectId, projects]);

  const availableSubContractors = useMemo(() => {
    if (!selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: NewInstructionFormValues) => {
    // Contextual Validation for Issuing
    if (submissionStatus === 'issued') {
      let hasError = false;
      if (!values.originalText || values.originalText.trim().length < 10) {
        form.setError('originalText', { message: 'Instructions must be at least 10 characters to formally issue.' });
        hasError = true;
      }
      if (!values.externalRecipient) {
        form.setError('externalRecipient', { message: 'An external partner must be selected to formally issue this instruction.' });
        hasError = true;
      }
      if (hasError) return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading documentation photos and files...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `internal-instructions/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `internal-instructions/files/${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        // Automatically include all project-assigned staff
        const internalStaffEmails = selectedProject?.assignedUsers || [];
        const combinedRecipients = [
            values.externalRecipient,
            ...internalStaffEmails
        ].filter(Boolean);

        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const reference = getNextReference(allInstructions, values.projectId, 'SI', initials);

        const instructionData = {
          reference,
          projectId: values.projectId,
          originalText: values.originalText || '',
          summary: values.originalText && values.originalText.length > 100 
            ? values.originalText.substring(0, 100) + '...' 
            : (values.originalText || 'No description provided'),
          actionItems: [],
          recipients: combinedRecipients,
          createdAt: new Date().toISOString(),
          photos: uploadedPhotos,
          files: uploadedFiles,
          status: submissionStatus
        };

        const colRef = collection(db, 'instructions');
        addDoc(colRef, instructionData)
          .then(() => {
            toast({ 
              title: 'Success', 
              description: submissionStatus === 'draft' 
                ? 'Instruction saved as draft.' 
                : 'Instruction recorded and issued.' 
            });
            setOpen(false);
          })
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: colRef.path,
              operation: 'create',
              requestResourceData: instructionData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });

      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to process instruction documentation.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setIsCameraOpen(false);
      setPhotos([]);
      setFiles([]);
      form.reset();
    }
  }, [open, form]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="mr-2 h-4 w-4" />New Instruction</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record New Site Instruction</DialogTitle>
          <DialogDescription>
            Capture requirements on-site and distribute to project partners. Internal project staff are notified automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger></FormControl>
                    <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="originalText"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Instruction Text</FormLabel>
                    <VoiceInput onResult={(text) => form.setValue('originalText', text)} />
                  </div>
                  <FormControl><Textarea placeholder="Describe what needs to be done..." className="min-h-[150px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Reference Documentation</FormLabel>
              <div className="space-y-4">
                {(photos.length > 0 || files.length > 0) && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {photos.map((p, i) => (
                        <div key={`p-${i}`} className="relative group">
                          <Image src={p.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                          <button type="button" className="absolute top-1 right-1 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                            <X className="h-4 w-4" />
                          </button>
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
                      <Button type="button" onClick={takePhoto}>Capture</Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                      <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Photos</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="mr-2 h-4 w-4" />Files (Max 10MB)</Button>
                    
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

            <Separator />
            
            <div className="space-y-4">
                <div className='flex flex-col gap-1'>
                    <div className="flex items-center gap-2">
                        <Users2 className="h-4 w-4 text-accent" />
                        <FormLabel className="font-bold">Primary Recipient (Project Partner)</FormLabel>
                    </div>
                    <p className='text-[10px] text-muted-foreground'>Select the contractor or designer to issue this instruction to. Optional for drafts.</p>
                </div>
                <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                    {availableSubContractors.map((sub) => (
                    <FormField
                        key={sub.id}
                        control={form.control}
                        name="externalRecipient"
                        render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                            <FormControl>
                            <Checkbox
                                checked={field.value === sub.email}
                                onCheckedChange={(checked) => {
                                    field.onChange(checked ? sub.email : '');
                                }}
                            />
                            </FormControl>
                            <div className="flex flex-col leading-none">
                                <div className="flex items-center gap-2">
                                    <FormLabel className="text-xs font-semibold">{sub.name}</FormLabel>
                                    <div className="flex gap-1">
                                        {sub.isDesigner && <span className="text-[8px] px-1 bg-primary/10 text-primary rounded">Designer</span>}
                                        {sub.isSubContractor && <span className="text-[8px] px-1 bg-accent/10 text-accent rounded">Sub</span>}
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{sub.email}</span>
                            </div>
                        </FormItem>
                        )}
                    />
                    ))}
                    {selectedProjectId && availableSubContractors.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8 italic">No external partners assigned to this project.</p>}
                </ScrollArea>
                <FormField control={form.control} name="externalRecipient" render={() => <FormMessage />} />
            </div>

            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="submit" 
                variant="outline" 
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={() => setSubmissionStatus('draft')}
              >
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save as Draft
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:flex-1" 
                disabled={isPending}
                onClick={() => setSubmissionStatus('issued')}
              >
                {isPending && submissionStatus === 'issued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save & Issue Instruction
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
