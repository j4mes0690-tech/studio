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
import { Pencil, Camera, Upload, X, RefreshCw, Loader2, Send, Save, Users2, FileText, FileIcon } from 'lucide-react';
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
import { sendSiteInstructionEmailAction } from './actions';
import { generateInstructionPDF } from '@/lib/pdf-utils';

const EditInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().optional().default(''),
  externalRecipient: z.string().optional().default(''),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type EditInstructionFormValues = z.infer<typeof EditInstructionSchema>;

type EditInstructionProps = {
  item: Instruction;
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function EditInstruction({ 
  item, 
  projects, 
  distributionUsers, 
  subContractors,
  open: externalOpen,
  onOpenChange: setExternalOpen
}: EditInstructionProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const form = useForm<EditInstructionFormValues>({
    resolver: zodResolver(EditInstructionSchema),
    defaultValues: {
      projectId: item.projectId,
      originalText: item.originalText,
      externalRecipient: '',
      status: item.status === 'issued' ? 'issued' : 'draft',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [selectedProjectId, projects]);

  const availableSubContractors = useMemo(() => {
    if (!selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  useEffect(() => {
    if (open && item) {
      const external = (item.recipients || []).find(email => 
        subContractors.some(s => s.email.toLowerCase() === email.toLowerCase())
      ) || '';
      
      form.reset({
        projectId: item.projectId,
        originalText: item.originalText,
        externalRecipient: external,
        status: item.status === 'issued' ? 'issued' : 'draft',
      });
      setPhotos(item.photos || []);
      setFiles(item.files || []);
    }
  }, [open, item, form, subContractors]);

  const onSubmit = (values: EditInstructionFormValues) => {
    if (values.status === 'issued') {
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
        toast({ title: 'Processing', description: 'Updating documentation and generating PDF...' });

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

        const updates: any = {
          projectId: values.projectId,
          originalText: values.originalText || '',
          summary: values.originalText && values.originalText.length > 100 ? values.originalText.substring(0, 100) + '...' : (values.originalText || 'No description'),
          recipients: combinedRecipients,
          photos: uploadedPhotos,
          files: uploadedFiles,
          status: values.status
        };

        const docRef = doc(db, 'instructions', item.id);
        await updateDoc(docRef, updates);

        const sub = subContractors.find(s => s.email === values.externalRecipient);
        if (values.status === 'issued' && sub) {
          try {
            const updatedInstruction = { ...item, ...updates };
            const pdf = await generateInstructionPDF(updatedInstruction, selectedProject, sub);
            const pdfBase64 = pdf.output('datauristring').split(',')[1];

            const additionalAttachments = [
              ...uploadedPhotos.map((p, i) => ({ name: `Appendix-Photo-${i + 1}.jpg`, url: p.url })),
              ...uploadedFiles.map(f => ({ name: f.name, url: f.url }))
            ];

            await sendSiteInstructionEmailAction({ 
              emails: combinedRecipients, 
              projectName: selectedProject?.name || 'Project', 
              reference: item.reference, 
              pdfBase64, 
              fileName: `SiteInstruction-${item.reference}.pdf`,
              additionalAttachments
            });
            
            await updateDoc(docRef, { distributedAt: new Date().toISOString() });
            toast({ title: 'Success', description: `Instruction updated and distributed to ${combinedRecipients.length} recipients.` });
          } catch (err) {
            console.error(err);
            toast({ title: 'Updated with Warning', description: 'Saved, but email distribution failed.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Success', description: 'Instruction updated.' });
        }
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to process update.', variant: 'destructive' });
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

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200; canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhotos([...photos, { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /><span className="sr-only">Edit Instruction</span></Button></DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Site Instruction</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="projectId" render={({ field }) => (
              <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="originalText" render={({ field }) => (
              <FormItem><div className="flex items-center justify-between"><FormLabel>Instruction Text</FormLabel><VoiceInput onResult={field.onChange} /></div><FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="space-y-4">
              <FormLabel>Documentation & Files</FormLabel>
              <div className="flex gap-2 flex-wrap">
                {photos.map((p, i) => (<div key={i} className="relative w-20 h-20"><Image src={p.url} alt="Site" fill className="rounded-md object-cover border" /><button type="button" className="absolute top-1 right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button></div>))}
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Photos</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="mr-2 h-4 w-4" />Files</Button>
              </div>
              
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border bg-muted/30 text-xs">
                    <span className="truncate">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>

              {isCameraOpen && (
                <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                  <video ref={videoRef} className="w-full aspect-video bg-muted rounded-md object-cover" autoPlay muted playsInline />
                  <div className="flex gap-2"><Button type="button" onClick={takePhoto}>Capture</Button><Button type="button" variant="outline" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button><Button type="button" variant="secondary" onClick={() => setIsCameraOpen(false)}>Cancel</Button></div>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-4">
                <div className="flex items-center gap-2"><Users2 className="h-4 w-4 text-accent" /><FormLabel className="font-bold">Primary Recipient (External Partner)</FormLabel></div>
                <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                    {availableSubContractors.map((sub) => (
                    <FormField key={sub.id} control={form.control} name="externalRecipient" render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0 mb-2"><FormControl><Checkbox checked={field.value === sub.email} onCheckedChange={(c) => field.onChange(c ? sub.email : '')} /></FormControl><div className="flex flex-col"><FormLabel className="text-xs font-semibold">{sub.name}</FormLabel><span className="text-[10px] text-muted-foreground">{sub.email}</span></div></FormItem>
                    )} />
                    ))}
                </ScrollArea>
                <FormField control={form.control} name="externalRecipient" render={() => <FormMessage />} />
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}><Save className="mr-2 h-4 w-4" />Save Draft</Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={() => form.setValue('status', 'issued')}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Update & Issue</Button>
            </DialogFooter>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
              const selected = e.target.files; if (!selected) return;
              Array.from(selected).forEach(f => {
                const reader = new FileReader();
                reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                reader.readAsDataURL(f);
              });
            }} />
            <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} />
            <canvas ref={canvasRef} className="hidden" />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
