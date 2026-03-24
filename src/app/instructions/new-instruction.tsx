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
import { PlusCircle, Camera, Upload, X, FileIcon, FileText, Loader2, Link as LinkIcon, Save, Send } from 'lucide-react';
import type { Project, Photo, FileAttachment, ClientInstruction, Instruction } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference, scrollToFirstError } from '@/lib/utils';
import { sendSiteInstructionEmailAction } from './actions';
import { CameraOverlay } from '@/components/camera-overlay';
import { ScrollArea } from '@/components/ui/scroll-area';

const NewInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  clientInstructionId: z.string().optional().nullable(),
  originalText: z
    .string()
    .min(10, 'Site instructions must be at least 10 characters.'),
  externalRecipient: z.string().optional().default(''),
  status: z.enum(['draft', 'issued']).default('draft'),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

type NewInstructionProps = {
  projects: Project[];
  allInstructions: Instruction[];
};

export function NewInstruction({ projects, allInstructions }: NewInstructionProps) {
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
      clientInstructionId: 'none',
      originalText: '',
      externalRecipient: '',
      status: 'draft',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const ciQuery = useMemoFirebase(() => {
    if (!db || !selectedProjectId) return null;
    return query(collection(db, 'client-instructions'), where('projectId', '==', selectedProjectId));
  }, [db, selectedProjectId]);
  const { data: clientDirectives } = useCollection<ClientInstruction>(ciQuery);

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

  const onSubmit = (values: NewInstructionFormValues) => {
    const isIssuing = values.status === 'issued';
    
    startTransition(async () => {
      try {
        toast({ title: isIssuing ? 'Issuing Instruction' : 'Saving Draft', description: 'Processing documentation...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `instructions/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `instructions/files/${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const reference = getNextReference(allInstructions, values.projectId, 'SI', initials);

        const instructionData = {
          reference,
          projectId: values.projectId,
          clientInstructionId: values.clientInstructionId === 'none' ? null : values.clientInstructionId,
          originalText: values.originalText,
          summary: values.originalText.length > 100 ? values.originalText.substring(0, 100) + '...' : values.originalText,
          actionItems: [],
          recipients: values.externalRecipient ? [values.externalRecipient] : [],
          createdAt: new Date().toISOString(),
          photos: uploadedPhotos,
          files: uploadedFiles,
          status: values.status,
          distributedAt: isIssuing ? new Date().toISOString() : null,
        };

        await addDoc(collection(db, 'instructions'), instructionData);
        toast({ title: 'Success', description: isIssuing ? 'Instruction issued and distributed.' : 'Instruction saved as draft.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to record instruction.', variant: 'destructive' });
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
          <Button className="font-bold">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Instruction
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
            <DialogTitle>Issue Site Instruction</DialogTitle>
            <DialogDescription>Record a formal instruction for trade partners. Link to client directives for traceability.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 px-6 py-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project</FormLabel>
                            <Select onValueChange={(v) => { field.onChange(v); form.setValue('clientInstructionId', 'none'); }} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="clientInstructionId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <LinkIcon className="h-3.5 w-3.5 text-primary" /> Linked Directive
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}>
                            <FormControl><SelectTrigger><SelectValue placeholder="No link" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">Standalone Instruction</SelectItem>
                                {clientDirectives?.map(ci => (
                                    <SelectItem key={ci.id} value={ci.id}>{ci.reference} - {ci.summary}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </FormItem>
                        )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="originalText"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Instruction Details</FormLabel>
                          <VoiceInput onResult={field.onChange} />
                        </div>
                        <FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormLabel>Evidence & Photos</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((p, i) => (
                        <div key={i} className="relative w-20 h-20 group">
                          <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                          <Button type="button" variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-6 border-t bg-muted/10 gap-3">
                <Button 
                    type="submit" 
                    variant="outline" 
                    className="w-full sm:w-auto h-12 gap-2" 
                    disabled={isPending} 
                    onClick={() => form.setValue('status', 'draft')}
                >
                    <Save className="mr-2 h-4 w-4" /> Save as Draft
                </Button>
                <Button 
                    type="submit" 
                    variant="outline" 
                    className="w-full sm:flex-1 h-12 font-bold gap-2" 
                    disabled={isPending} 
                    onClick={() => form.setValue('status', 'issued')}
                >
                    <Save className="mr-2 h-4 w-4" /> Save
                </Button>
                <Button 
                    type="submit" 
                    className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                    disabled={isPending} 
                    onClick={() => form.setValue('status', 'issued')}
                >
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-5 w-5" />} Save & Issue
                </Button>
              </DialogFooter>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                const selected = e.target.files; if (!selected) return;
                Array.from(selected).forEach(f => {
                  const reader = new FileReader();
                  reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                  reader.readAsDataURL(f);
                });
              }} />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture}
        title="Site Instruction capture"
      />
    </>
  );
}
