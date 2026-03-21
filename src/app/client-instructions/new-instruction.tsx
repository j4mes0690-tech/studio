
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
import { PlusCircle, Camera, Upload, X, FileIcon, FileText, Loader2 } from 'lucide-react';
import type { Project, Photo, FileAttachment, ClientInstruction } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { sendClientInstructionEmailAction } from './actions';
import { CameraOverlay } from '@/components/camera-overlay';

const NewInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z
    .string()
    .min(10, 'Client directives must be at least 10 characters.'),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

type NewInstructionProps = {
  projects: Project[];
  allInstructions: ClientInstruction[];
};

export function NewClientInstruction({ projects, allInstructions }: NewInstructionProps) {
  const [open, setOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);

  const form = useForm<NewInstructionFormValues>({
    resolver: zodResolver(NewInstructionSchema),
    defaultValues: {
      projectId: '',
      originalText: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const onCapture = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    Array.from(selectedFiles).forEach(f => {
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    Array.from(selected).forEach(f => {
      const reader = new FileReader();
      reader.onload = async (re) => {
        const raw = re.target?.result as string;
        const optimized = await optimizeImage(raw);
        setPhotos(prev => [...prev, { url: optimized, takenAt: new Date().toISOString() }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const onSubmit = (values: NewInstructionFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading media documentation...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `client-instructions/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `client-instructions/files/${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const reference = getNextReference(allInstructions, values.projectId, 'CI', initials);

        // Automatically include all project assigned users in the distribution
        const projectRecipients = selectedProject?.assignedUsers || [];
        const summaryText = values.originalText.length > 100 
          ? values.originalText.substring(0, 100) + '...' 
          : values.originalText;

        const instructionData = {
          reference,
          projectId: values.projectId,
          originalText: values.originalText,
          summary: summaryText,
          actionItems: [],
          recipients: projectRecipients,
          createdAt: new Date().toISOString(),
          photos: uploadedPhotos,
          files: uploadedFiles,
          messages: [],
          status: 'open',
        };

        const colRef = collection(db, 'client-instructions');
        await addDoc(colRef, instructionData)
          .then(async () => {
            // Trigger automated email distribution to the team
            if (projectRecipients.length > 0) {
              await sendClientInstructionEmailAction({
                emails: projectRecipients,
                projectName: selectedProject?.name || 'Project',
                reference,
                status: 'open',
                text: values.originalText,
                summary: summaryText
              });
            }
            
            toast({ title: 'Success', description: `Client directive recorded. Automatically distributed to ${projectRecipients.length} project staff members.` });
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
        toast({ title: 'Error', description: 'Failed to upload media documentation.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setFiles([]);
      form.reset();
    }
  }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Client Instruction
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Client Instruction</DialogTitle>
            <DialogDescription>
              Capture external directives. This will be automatically distributed to all project-assigned staff.
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
                name="originalText"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Client Directive / Request</FormLabel>
                      <VoiceInput 
                        onResult={(text) => {
                          form.setValue('originalText', text);
                        }} 
                      />
                    </div>
                    <FormControl>
                      <Textarea placeholder="What did the client instruct?" className="min-h-[150px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Reference Documentation</FormLabel>
                <div className="space-y-4">
                  {(photos.length > 0 || files.length > 0) && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map((p, i) => (
                          <div key={`p-${i}`} className="relative group">
                            <Image src={p.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-3 w-3" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-3 w-3" />
                            </Button>
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
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Photos</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="mr-2 h-4 w-4" />Files</Button>
                    
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handlePhotoSelect} />
                    <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" />
                  </div>
                </div>
              </FormItem>

              <Separator />
              
              <div className="p-4 bg-muted/20 rounded-lg border border-dashed text-center">
                  <p className="text-xs text-muted-foreground">
                      Recording this instruction will automatically notify all staff assigned to the project.
                  </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Record Directive
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture}
        title="Client Directive documentation"
      />
    </>
  );
}
