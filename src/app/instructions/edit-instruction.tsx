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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
    // Contextual Validation for Issuing
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
        toast({ title: 'Processing', description: 'Updating documentation...' });

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
        const combinedRecipients = [
            values.externalRecipient,
            ...internalStaffEmails
        ].filter(Boolean);

        const updates: any = {
          projectId: values.projectId,
          originalText: values.originalText || '',
          summary: values.originalText && values.originalText.length > 100 
            ? values.originalText.substring(0, 100) + '...' 
            : (values.originalText || 'No description provided'),
          recipients: combinedRecipients,
          photos: uploadedPhotos,
          files: uploadedFiles,
          status: values.status
        };

        const docRef = doc(db, 'instructions', item.id);
        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        // AUTOMATED DISTRIBUTION FLOW (If issuing or re-issuing)
        const sub = subContractors.find(s => s.email === values.externalRecipient);
        if (values.status === 'issued' && sub) {
          try {
            const { jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas')).default;

            const reportElement = document.createElement('div');
            reportElement.style.position = 'absolute';
            reportElement.style.left = '-9999px';
            reportElement.style.padding = '40px';
            reportElement.style.width = '800px';
            reportElement.style.background = 'white';
            reportElement.style.color = 'black';
            reportElement.style.fontFamily = 'sans-serif';

            reportElement.innerHTML = `
              <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Site Instruction</h1>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${item.reference}</p>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project Location</p>
                  <p style="margin: 0; font-size: 16px; font-weight: bold;">${selectedProject?.name || 'Unknown'}</p>
                  ${selectedProject?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569;">${selectedProject.address}</p>` : ''}
                </div>
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Issued To</p>
                  <p style="margin: 0; font-size: 16px; font-weight: bold;">${sub.name}</p>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">${sub.email}</p>
                </div>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px; min-height: 200px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Instruction Details</h2>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${values.originalText}</p>
              </div>
              ${uploadedPhotos.length > 0 ? `
                <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                  ${uploadedPhotos.map(p => `<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><img src="${p.url}" style="width: 100%; height: 200px; object-fit: cover;" /></div>`).join('')}
                </div>
              ` : ''}
            `;

            document.body.appendChild(reportElement);
            const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            document.body.removeChild(reportElement);

            const pdfBase64 = pdf.output('datauristring').split(',')[1];
            
            await sendSiteInstructionEmailAction({
              email: sub.email,
              name: sub.name,
              projectName: selectedProject?.name || 'Project',
              reference: item.reference,
              pdfBase64,
              fileName: `SiteInstruction-${item.reference}.pdf`
            });

            await updateDoc(docRef, { distributedAt: new Date().toISOString() });
            toast({ title: 'Success', description: `Instruction updated and emailed to ${sub.name}.` });
          } catch (err) {
            console.error('Auto-email error:', err);
            toast({ title: 'Updated with Warning', description: 'Instruction saved, but email distribution encountered an error.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Success', description: values.status === 'draft' ? 'Instruction updated as draft.' : 'Instruction updated and issued.' });
        }

        setOpen(false);

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
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Camera access denied');
      }
    };
    if (isCameraOpen) getCameraPermission();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
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
      reader.onload = (re) => setFiles(prev => [...prev, {
        name: f.name,
        type: f.type,
        size: f.size,
        url: re.target?.result as string
      }]);
      reader.readAsDataURL(f);
    });
  };

  const submissionStatus = form.watch('status');

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
            Modify instructions or documentation. Formal issuing requires a description and a recipient.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('id')} />
            
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
            
            <div className="space-y-4">
                <div className='flex flex-col gap-1'>
                    <div className="flex items-center gap-2">
                        <Users2 className="h-4 w-4 text-accent" />
                        <FormLabel className="font-bold">Primary Recipient (External Partner)</FormLabel>
                    </div>
                    <p className='text-[10px] text-muted-foreground'>Select the contractor or designer to issue this instruction to. All project staff are CC'd automatically.</p>
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

            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button 
                type="submit" 
                variant="outline" 
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={() => form.setValue('status', 'draft')}
              >
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save as Draft
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:flex-1" 
                disabled={isPending}
                onClick={() => form.setValue('status', 'issued')}
              >
                {isPending && (submissionStatus === 'issued') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Save & Issue Instruction
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
