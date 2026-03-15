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
import { PlusCircle, Camera, Upload, X, FileIcon, FileText, Loader2, ShieldCheck, Users2, Save, Send } from 'lucide-react';
import type { Project, Photo, FileAttachment, ClientInstruction, DistributionUser, SubContractor, InformationRequest } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference, getPartnerEmails } from '@/lib/utils';
import { sendInformationRequestEmailAction } from './actions';
import { generateInformationRequestPDF } from '@/lib/pdf-utils';
import { DatePicker } from '@/components/date-picker';
import { CameraOverlay } from '@/components/camera-overlay';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const NewInformationRequestSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().optional().default(''),
  assignedTo: z.array(z.string()).min(1, 'A recipient must be assigned.'),
  requiredBy: z.string().optional(),
  status: z.enum(['draft', 'open']).default('open'),
});

type NewInformationRequestFormValues = z.infer<typeof NewInformationRequestSchema>;

export function NewInformationRequest({ projects, distributionUsers, subContractors, currentUser, allRequests }: { 
  projects: Project[]; 
  distributionUsers: DistributionUser[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
  allRequests: InformationRequest[];
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const form = useForm<NewInformationRequestFormValues>({
    resolver: zodResolver(NewInformationRequestSchema),
    defaultValues: {
      projectId: '',
      description: '',
      assignedTo: [],
      requiredBy: undefined,
      status: 'open',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

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

  const onSubmit = (values: NewInformationRequestFormValues) => {
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
        toast({ title: 'Processing', description: 'Generating PDF and sending notification...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `information-requests/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `information-requests/files/${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const targetEmail = (values.assignedTo[0] || '').replace(/^(staff|partner):/, '');
        const sub = availableExternalPartners.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
        const prefix = sub ? 'RFI' : 'CRFI';
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const reference = getNextReference(allRequests, values.projectId, prefix, initials);

        const requestData: any = {
          reference,
          projectId: values.projectId,
          description: values.description || '',
          assignedTo: (values.assignedTo || []).map(e => e.replace(/^(staff|partner):/, '').toLowerCase().trim()),
          raisedBy: currentUser.email.toLowerCase().trim(),
          photos: uploadedPhotos,
          files: uploadedFiles,
          requiredBy: values.requiredBy || null,
          status: values.status,
          messages: [],
          createdAt: new Date().toISOString(),
        };

        const colRef = collection(db, 'information-requests');
        const newDocRef = await addDoc(colRef, requestData).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: requestData,
          }));
          throw error;
        });

        if (values.status === 'open') {
            const recipientEmails = new Set<string>();
            recipientEmails.add(targetEmail.toLowerCase().trim());

            if (sub) {
                const partnerUsers = getPartnerEmails(sub.id, subContractors, distributionUsers);
                partnerUsers.forEach(e => recipientEmails.add(e));
            }

            const assignedToNames = values.assignedTo.map(val => {
                const email = val.replace(/^(staff|partner):/, '');
                return (distributionUsers || []).find(u => u.email === email)?.name || email;
            });
            const pdf = await generateInformationRequestPDF({ ...requestData, id: newDocRef.id } as InformationRequest, selectedProject, assignedToNames);
            const pdfBase64 = pdf.output('datauristring').split(',')[1];

            await sendInformationRequestEmailAction({
                emails: Array.from(recipientEmails),
                projectName: selectedProject?.name || 'Project',
                reference,
                description: values.description,
                raisedBy: currentUser.name,
                requestId: newDocRef.id,
                pdfBase64,
                fileName: `RFI-${reference}.pdf`
            });
        }

        toast({ title: 'Success', description: values.status === 'draft' ? 'Request saved as draft.' : `${prefix} logged and distributed with PDF.` });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to process request.', variant: 'destructive' });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    
    Array.from(selectedFiles).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: 'File Too Large', description: `${f.name} exceeds the 10MB limit.`, variant: 'destructive' });
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
    if (!open) {
      setPhotos([]);
      setFiles([]);
      form.reset();
    }
  }, [open, form]);

  const submissionStatus = form.watch('status');

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Information Request (CRFI / RFI)</DialogTitle>
            <DialogDescription>
              Record a query for project team members or trade partners. Formal issuance triggers an email with PDF attachment.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(val) => { field.onChange(val); form.setValue('assignedTo', []); }} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
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
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To (Recipient)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange([val])} 
                        value={field.value?.[0] || ""}
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
                              <SelectItem key={`staff-${u.email}`} value={`staff:${u.email}`}>{u.name} ({u.email})</SelectItem>
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
                              <SelectItem key={`partner-${s.email}`} value={`partner:${s.email}`}>{s.name}</SelectItem>
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
                      <FormLabel>Inquiry Details</FormLabel>
                      <VoiceInput onResult={(text) => form.setValue('description', text)} />
                    </div>
                    <FormControl>
                      <Textarea placeholder="What information is required? Be specific." className="min-h-[120px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requiredBy"
                render={({ field }) => (
                  <DatePicker field={field} label="Required By (Optional)" />
                )}
              />

              <Separator />

              <div className="space-y-4">
                <FormLabel>Documentation & Visual Context</FormLabel>
                <div className="space-y-4">
                  {(photos.length > 0 || files.length > 0) && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map((p, i) => (
                          <div key={`p-${i}`} className="relative group">
                            <Image src={p.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                            <Button type="button" variant="destructive" size="icon" className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
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
                </div>
              </div>
              
              <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button 
                  type="submit" 
                  variant="outline" 
                  className="w-full sm:w-auto h-12"
                  disabled={isPending}
                  onClick={() => form.setValue('status', 'draft')}
                >
                  {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                  Save as Draft
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:flex-1 h-12 text-lg font-bold" 
                  disabled={isPending}
                  onClick={() => form.setValue('status', 'open')}
                >
                  {isPending && submissionStatus === 'open' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 mr-2" />}
                  Save & Log Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
      />
    </>
  );
}
