
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
import { Pencil, Camera, Upload, X, RefreshCw, HardHat, ShieldCheck, FileIcon, FileText, Users2, Shield } from 'lucide-react';
import type { Project, DistributionUser, Photo, SubContractor, FileAttachment, Instruction } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { summarizeInstructions } from '@/ai/flows/summarize-client-instructions';
import { extractInstructionActionItems } from '@/ai/flows/extract-instruction-action-items';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EditInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().min(10, 'Instructions must be at least 10 characters.'),
  externalRecipient: z.string().min(1, 'You must select exactly one external partner to issue this instruction.'),
  internalRecipients: z.array(z.string()).optional(),
});

type EditInstructionFormValues = z.infer<typeof EditInstructionSchema>;

type EditInstructionProps = {
  item: Instruction;
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
};

export function EditInstruction({ item, projects, distributionUsers, subContractors }: EditInstructionProps) {
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

  const form = useForm<EditInstructionFormValues>({
    resolver: zodResolver(EditInstructionSchema),
    defaultValues: {
      projectId: item.projectId,
      originalText: item.originalText,
      externalRecipient: '',
      internalRecipients: [],
    },
  });

  const selectedProjectId = form.watch('projectId');

  const availableSubContractors = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return [];
    const assignedIds = project.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, projects, subContractors]);

  const availableInternalUsers = useMemo(() => {
    if (!selectedProjectId) return [];
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return [];
    const assignedEmails = project.assignedUsers || [];
    return distributionUsers.filter(u => 
      assignedEmails.some(email => email.toLowerCase().trim() === u.email.toLowerCase().trim())
    );
  }, [selectedProjectId, projects, distributionUsers]);

  useEffect(() => {
    if (open && item) {
      // Split recipients back into external and internal
      const external = (item.recipients || []).find(email => 
        subContractors.some(s => s.email.toLowerCase() === email.toLowerCase())
      ) || '';
      
      const internal = (item.recipients || []).filter(email => 
        email.toLowerCase() !== external.toLowerCase()
      );

      form.reset({
        projectId: item.projectId,
        originalText: item.originalText,
        externalRecipient: external,
        internalRecipients: internal,
      });
      setPhotos(item.photos || []);
      setFiles(item.files || []);
    }
  }, [open, item, form, subContractors]);

  const onSubmit = (values: EditInstructionFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading media and running AI analysis...' });

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

        let summary = item.summary;
        let actionItems = item.actionItems;

        if (values.originalText !== item.originalText) {
            const [summaryResult, actionItemsResult] = await Promise.all([
                summarizeInstructions({ instructions: values.originalText }),
                extractInstructionActionItems({ instructionText: values.originalText }),
            ]);
            summary = summaryResult.summary;
            actionItems = actionItemsResult.actionItems;
        }

        const combinedRecipients = [
            values.externalRecipient,
            ...(values.internalRecipients || [])
        ].filter(Boolean);

        const updates = {
          projectId: values.projectId,
          originalText: values.originalText,
          summary,
          actionItems,
          recipients: combinedRecipients,
          photos: uploadedPhotos,
          files: uploadedFiles,
        };

        const docRef = doc(db, 'instructions', item.id);
        updateDoc(docRef, updates)
          .then(() => {
            toast({ title: 'Success', description: 'Instruction updated.' });
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
        toast({ title: 'Error', description: 'Failed to process update.', variant: 'destructive' });
      }
    });
  };

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
        <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit Instruction</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site Instruction</DialogTitle>
          <DialogDescription>
            Modify instructions or documentation. AI will re-analyze if text is updated.
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
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                  <FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Documentation</FormLabel>
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
                      <Button type="button" size="sm" onClick={takePhoto}>Capture</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Photos</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="mr-2 h-4 w-4" />Files</Button>
                    
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className='flex flex-col gap-1'>
                        <div className="flex items-center gap-2">
                            <Users2 className="h-4 w-4 text-accent" />
                            <FormLabel className="font-bold">Primary Recipient (External)</FormLabel>
                        </div>
                        <p className='text-[10px] text-muted-foreground'>Select exactly one partner to issue this SI to.</p>
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
                                    onCheckedChange={(c) => {
                                        field.onChange(c ? sub.email : '');
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
                        {availableSubContractors.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8 italic">No external partners assigned to this project.</p>}
                    </ScrollArea>
                    <FormField control={form.control} name="externalRecipient" render={() => <FormMessage />} />
                </div>

                <div className="space-y-4">
                    <div className='flex flex-col gap-1'>
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <FormLabel className="font-bold">Staff Notifications (Internal)</FormLabel>
                        </div>
                        <p className='text-[10px] text-muted-foreground'>Select team members to be notified.</p>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {availableInternalUsers.map((user) => (
                        <FormField
                            key={user.id}
                            control={form.control}
                            name="internalRecipients"
                            render={({ field }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(user.email)}
                                    onCheckedChange={(c) => {
                                        const curr = field.value || [];
                                        field.onChange(c ? [...curr, user.email] : curr.filter(v => v !== user.email));
                                    }}
                                />
                                </FormControl>
                                <div className="flex flex-col leading-none">
                                    <FormLabel className="text-xs font-semibold">{user.name}</FormLabel>
                                    <span className="text-[10px] text-muted-foreground">{user.email}</span>
                                </div>
                            </FormItem>
                            )}
                        />
                        ))}
                        {availableInternalUsers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-8 italic">No staff assigned to this project.</p>}
                    </ScrollArea>
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter className="pt-4 border-t">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Saving...' : 'Save Instruction Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
