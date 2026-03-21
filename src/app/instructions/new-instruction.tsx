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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Camera, Upload, X, RefreshCw, FileIcon, FileText, Loader2, Users2, Send, Save, CheckCircle2 } from 'lucide-react';
import type { Project, Photo, FileAttachment, Instruction, SubContractor, DistributionUser } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference, scrollToFirstError } from '@/lib/utils';
import { sendSiteInstructionEmailAction } from './actions';
import { generateInstructionPDF } from '@/lib/pdf-utils';
import { CameraOverlay } from '@/components/camera-overlay';

const NewInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().optional().default(''),
  externalRecipient: z.string().optional().default(''),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

interface NewInstructionProps {
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
  allInstructions: Instruction[];
}

export function NewInstruction({ projects, distributionUsers, subContractors, allInstructions }: NewInstructionProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [submitMode, setSubmitMode] = useState<'draft' | 'save' | 'issue'>('issue');

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const form = useForm<NewInstructionFormValues>({
    resolver: zodResolver(NewInstructionSchema),
    defaultValues: {
      projectId: '',
      originalText: '',
      externalRecipient: '',
      status: 'issued',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [selectedProjectId, projects]);

  const availableSubContractors = useMemo(() => {
    if (!selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: NewInstructionFormValues) => {
    const isIssuing = submitMode === 'issue';
    const isDrafting = submitMode === 'draft';

    if (isIssuing) {
      let hasError = false;
      if (!values.originalText || values.originalText.trim().length < 10) {
        form.setError('originalText', { message: 'Instructions must be at least 10 characters to formally issue.' }, { shouldFocus: true });
        hasError = true;
      }
      if (!values.externalRecipient) {
        form.setError('externalRecipient', { message: 'An external partner must be selected to formally issue this instruction.' }, { shouldFocus: true });
        hasError = true;
      }
      if (hasError) return;
    }

    startTransition(async () => {
      try {
        toast({ 
          title: isIssuing ? 'Issuing Instruction' : 'Saving Draft', 
          description: isIssuing ? 'Uploading documentation and generating PDF...' : 'Saving progress and media...' 
        });

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

        const internalStaffEmails = selectedProject?.assignedUsers || [];
        const combinedRecipients = [values.externalRecipient, ...internalStaffEmails].filter(Boolean);

        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allInstructions.map(o => ({ reference: o.reference, projectId: o.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'SI', initials);

        const targetStatus = isIssuing ? 'issued' : 'draft';

        const instructionData = {
          reference,
          projectId: values.projectId,
          originalText: values.originalText || '',
          summary: values.originalText && values.originalText.length > 100 ? values.originalText.substring(0, 100) + '...' : (values.originalText || 'No description'),
          actionItems: [],
          recipients: combinedRecipients,
          createdAt: new Date().toISOString(),
          photos: uploadedPhotos,
          files: uploadedFiles,
          status: targetStatus
        };

        const colRef = collection(db, 'instructions');
        const newDocRef = await addDoc(colRef, instructionData);

        const sub = subContractors.find(s => s.email === values.externalRecipient);
        if (isIssuing && sub) {
          try {
            const fullInstruction = { ...instructionData, id: newDocRef.id } as Instruction;
            const pdf = await generateInstructionPDF(fullInstruction, selectedProject, sub);
            const pdfBase64 = pdf.output('datauristring').split(',')[1];

            const additionalAttachments = [
              ...uploadedPhotos.map((p, i) => ({ name: `Appendix-Photo-${i + 1}.jpg`, url: p.url })),
              ...uploadedFiles.map(f => ({ name: f.name, url: f.url }))
            ];

            await sendSiteInstructionEmailAction({ 
              to: [values.externalRecipient],
              cc: internalStaffEmails,
              projectName: selectedProject?.name || 'Project', 
              reference, 
              pdfBase64, 
              fileName: `SiteInstruction-${reference}.pdf`,
              additionalAttachments
            });
            
            await updateDoc(doc(db, 'instructions', newDocRef.id), { distributedAt: new Date().toISOString() });
            toast({ title: 'Success', description: `Instruction issued and distributed to ${combinedRecipients.length} project personnel.` });
          } catch (err) {
            console.error(err);
            toast({ title: 'Issued with Warning', description: 'Instruction saved, but email failed.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Success', description: isDrafting ? 'Draft saved.' : 'Instruction recorded.' });
        }
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save instruction.', variant: 'destructive' });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    Array.from(selectedFiles).forEach(f => {
      const reader = new FileReader();
      reader.onload = (re) => setFiles(prev => [...prev, { name: f.name, type: f.type, size: f.size, url: re.target?.result as string }]);
      reader.readAsDataURL(f);
    });
  };

  useEffect(() => { if (!open) { setPhotos([]); setFiles([]); form.reset(); } }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />New Instruction</Button></DialogTrigger>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 shadow-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Record New Site Instruction</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstError())} className="space-y-6 p-6">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Project</FormLabel>
                  <Select onValueChange={(val) => { field.onChange(val); form.setValue('externalRecipient', ''); }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField
                control={form.control}
                name="externalRecipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-accent" />
                      Primary Trade Partner
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign a contractor or designer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSubContractors.map((sub) => (
                          <SelectItem key={sub.id} value={sub.email}>
                            {sub.name}
                          </SelectItem>
                        ))}
                        {availableSubContractors.length === 0 && (
                          <div className="p-2 text-xs text-muted-foreground italic text-center">
                            No partners assigned to this project.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">
                      The selected partner will be the primary recipient. All other project staff will be CC'd automatically.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="originalText" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Instruction Text</FormLabel>
                    <VoiceInput onResult={field.onChange} />
                  </div>
                  <FormControl>
                    <Textarea placeholder="Describe what needs to be done..." className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-4">
                <FormLabel>Documentation & Files</FormLabel>
                <div className="flex gap-2 flex-wrap">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 group">
                      <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                      <button 
                        type="button" 
                        className="absolute top-1 right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
                        onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} className="gap-2">
                    <Camera className="h-4 w-4" /> Camera
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" /> Photos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()} className="gap-2">
                    <FileIcon className="h-4 w-4" /> Files
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t bg-background">
                <Button 
                  type="submit" 
                  variant="outline" 
                  className="w-full sm:w-auto h-12 gap-2 font-bold" 
                  disabled={isPending} 
                  onClick={() => setSubmitMode('draft')}
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                  disabled={isPending} 
                  onClick={() => setSubmitMode('issue')}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Save & Issue Instruction
                </Button>
              </div>
              
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                const selected = e.target.files; 
                if (!selected) return;
                Array.from(selected).forEach(f => {
                  const reader = new FileReader();
                  reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                  reader.readAsDataURL(f);
                });
              }} />
              <input 
                type="file" 
                ref={docInputRef} 
                className="hidden" 
                multiple 
                onChange={handleFileSelect} 
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
              />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
        title="Site Instruction Photo"
      />
    </>
  );
}
