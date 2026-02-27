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
import { Pencil, Camera, Upload, X, RefreshCw, Loader2, Send, Save } from 'lucide-react';
import type { Project, SubContractor, Photo, CleanUpNotice } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { sendCleanUpNoticeEmailAction } from './actions';

const EditNoticeSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().optional().default(''),
  recipients: z.array(z.string()).optional(),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type EditNoticeFormValues = z.infer<typeof EditNoticeSchema>;

type EditNoticeProps = {
  notice: CleanUpNotice;
  projects: Project[];
  subContractors: SubContractor[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function EditCleanUpNotice({ notice, projects, subContractors, open: externalOpen, onOpenChange: setExternalOpen }: EditNoticeProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>(notice.photos || []);

  const form = useForm<EditNoticeFormValues>({
    resolver: zodResolver(EditNoticeSchema),
    defaultValues: {
      projectId: notice.projectId,
      description: notice.description || '',
      recipients: [],
      status: notice.status === 'issued' ? 'issued' : 'draft',
    },
  });

  useEffect(() => {
    if (open && notice) {
      const recipientIds = subContractors
        .filter(sub => (notice.recipients || []).includes(sub.email))
        .map(sub => sub.id);

      form.reset({
        projectId: notice.projectId,
        description: notice.description || '',
        recipients: recipientIds,
        status: notice.status === 'issued' ? 'issued' : 'draft',
      });
      setPhotos(notice.photos || []);
    }
  }, [open, notice, form, subContractors]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  const onSubmit = (values: EditNoticeFormValues) => {
    if (values.status === 'issued') {
      let hasError = false;
      if (!values.description || values.description.trim().length < 10) {
        form.setError('description', { message: 'Description must be at least 10 characters to formally issue.' });
        hasError = true;
      }
      if (!values.recipients || values.recipients.length === 0) {
        form.setError('recipients', { message: 'At least one sub-contractor must be selected to issue this notice.' });
        hasError = true;
      }
      if (hasError) return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Updating documentation and media...' });

        // 1. Upload New Photos
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `cleanup-notices/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const recipientContacts = subContractors.filter(sub => values.recipients?.includes(sub.id));
        const recipientEmails = recipientContacts.map(sub => sub.email);

        const updates = {
          projectId: values.projectId,
          description: values.description || '',
          recipients: recipientEmails,
          photos: uploadedPhotos,
          status: values.status,
        };

        const docRef = doc(db, 'cleanup-notices', notice.id);
        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        // 2. Automated Distribution via PDF (Only if issued)
        if (values.status === 'issued' && recipientContacts.length > 0) {
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
                <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Clean Up Notice</h1>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${notice.reference}</p>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                <div>
                  <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p>
                  <p style="margin: 2px 0 0 0; font-size: 16px;">${selectedProject?.name || 'Project'}</p>
                </div>
                <div>
                  <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Date Issued</p>
                  <p style="margin: 2px 0 0 0; font-size: 16px;">${new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Issue Description</h2>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${values.description}</p>
              </div>

              ${uploadedPhotos.length > 0 ? `
                <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                  ${uploadedPhotos.map(p => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 10px;">
                      <img src="${p.url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;" />
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="font-size: 12px; color: #64748b;">This notice was generated via SiteCommand.</p>
              </div>
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

            for (const sub of recipientContacts) {
              await sendCleanUpNoticeEmailAction({
                email: sub.email,
                name: sub.name,
                projectName: selectedProject?.name || 'Project',
                reference: notice.reference,
                pdfBase64,
                fileName: `CleanUpNotice-${notice.reference}.pdf`
              });
            }
            toast({ title: 'Success', description: 'Notice issued and distributed to trade partners.' });
          } catch (err) {
            console.error('PDF Distribution Error:', err);
            toast({ title: 'Record Saved', description: 'Notice saved, but email distribution encountered an error.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Success', description: values.status === 'draft' ? 'Notice updated as draft.' : 'Clean up notice recorded.' });
        }

        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to process notice update.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {}
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

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit Notice</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Clean Up Notice</DialogTitle>
          <DialogDescription>
            Update the issue description or site documentation.
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
                  <Select 
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue('recipients', []);
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Description of Issue</FormLabel>
                    <VoiceInput 
                      onResult={(text) => {
                        form.setValue('description', text);
                      }} 
                    />
                  </div>
                  <FormControl>
                    <Textarea placeholder="Describe the cleaning requirement..." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Photos</FormLabel>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group">
                      <Image src={p.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
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
                    <Button type="button" onClick={takePhoto}>Capture</Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} title="Switch Camera">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
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

            <Separator />
            
            <FormItem>
              <FormLabel>Recipients (Sub-contractors)</FormLabel>
              <ScrollArea className="h-40 rounded-md border p-4 bg-muted/5">
                {projectSubs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 italic">
                    {selectedProjectId ? "No sub-contractors assigned to this project." : "Select a project to view assigned partners."}
                  </p>
                ) : projectSubs.map((sub) => (
                  <FormField
                    key={sub.id}
                    control={form.control}
                    name="recipients"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(sub.id)}
                            onCheckedChange={(c) => {
                              const curr = field.value || [];
                              field.onChange(c ? [...curr, sub.id] : curr.filter(v => v !== sub.id));
                            }}
                          />
                        </FormControl>
                        <div className="flex flex-col">
                          <FormLabel className="font-normal text-sm">{sub.name}</FormLabel>
                          <span className="text-[10px] text-muted-foreground">{sub.email}</span>
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
              </ScrollArea>
              <FormField control={form.control} name="recipients" render={() => <FormMessage />} />
            </FormItem>

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
                {isPending && submissionStatus === 'issued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Save & Distribute Notice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
