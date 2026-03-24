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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, 
  Camera, 
  Image as ImageIcon, 
  Paperclip, 
  X, 
  FileText, 
  Loader2, 
  ShieldCheck, 
  Users2, 
  Save, 
  Send,
  Link as LinkIcon,
  Building2
} from 'lucide-react';
import type { Project, Photo, FileAttachment, DistributionUser, SubContractor, InformationRequest, ClientInstruction } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { getProjectInitials, getNextReference, getPartnerEmails, scrollToFirstError } from '@/lib/utils';
import { sendInformationRequestEmailAction } from './actions';
import { generateInformationRequestPDF } from '@/lib/pdf-utils';
import { DatePicker } from '@/components/date-picker';
import { CameraOverlay } from '@/components/camera-overlay';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const NewInformationRequestSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  clientInstructionId: z.string().optional().nullable(),
  description: z.string().optional().default(''),
  assignedTo: z.array(z.string()).default([]),
  requiredBy: z.string().optional(),
  status: z.enum(['draft', 'open']).default('open'),
}).superRefine((data, ctx) => {
  if (data.status === 'open') {
    if (data.assignedTo.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A recipient must be assigned to formally log this request.", path: ["assignedTo"] });
    }
    if (!data.description || data.description.trim().length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enquiry details must be at least 10 characters to formally log.", path: ["description"] });
    }
  }
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
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const form = useForm<NewInformationRequestFormValues>({
    resolver: zodResolver(NewInformationRequestSchema),
    defaultValues: { projectId: '', clientInstructionId: 'none', description: '', assignedTo: [], requiredBy: undefined, status: 'open' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const ciQuery = useMemoFirebase(() => {
    if (!db || !selectedProjectId) return null;
    return query(collection(db, 'client-instructions'), where('projectId', '==', selectedProjectId));
  }, [db, selectedProjectId]);
  const { data: clientDirectives } = useCollection<ClientInstruction>(ciQuery);

  const availableInternalUsers = useMemo(() => {
    if (!selectedProject) return [];
    const assignedEmails = selectedProject.assignedUsers || [];
    return (distributionUsers || []).filter(u => assignedEmails.some(email => email.toLowerCase().trim() === u.email.toLowerCase().trim()));
  }, [selectedProject, distributionUsers]);

  const availableExternalPartners = useMemo(() => {
    if (!selectedProject || !subContractors) return [];
    const assignedSubIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedSubIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: NewInformationRequestFormValues) => {
    startTransition(async () => {
      try {
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            const blob = await dataUriToBlob(p.url);
            const url = await uploadFile(storage, `information-requests/photos/${Date.now()}-${i}.jpg`, blob);
            return { ...p, url };
          })
        );

        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allRequests.map(o => ({ reference: o.reference, projectId: o.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'RFI', initials);

        const requestData: any = {
          reference,
          projectId: values.projectId,
          clientInstructionId: values.clientInstructionId === 'none' ? null : values.clientInstructionId,
          description: values.description || '',
          assignedTo: (values.assignedTo || []).map(e => e.replace(/^(staff|partner):/, '').toLowerCase().trim()),
          raisedBy: currentUser.email.toLowerCase().trim(),
          photos: uploadedPhotos,
          files: [],
          requiredBy: values.requiredBy || null,
          status: values.status,
          messages: [],
          createdAt: new Date().toISOString(),
        };

        const newDocRef = await addDoc(collection(db, 'information-requests'), requestData);
        toast({ title: 'Success', description: values.status === 'draft' ? 'Draft saved.' : 'RFI logged.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to process request.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => { if (!open) { setPhotos([]); setFiles([]); form.reset(); } }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" />New Request</Button></DialogTrigger>
        <DialogContent 
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle>Log Information Request</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 h-5">
                        <Building2 className="h-3.5 w-3.5 text-primary" /> Project
                    </FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); form.setValue('clientInstructionId', 'none'); }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger></FormControl>
                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientInstructionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 h-5">
                        <LinkIcon className="h-3.5 w-3.5 text-primary" /> Linked Directive
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="none">No Link</SelectItem>{clientDirectives?.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.reference} - {ci.summary}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><div className="flex justify-between items-center"><FormLabel>Enquiry</FormLabel><VoiceInput onResult={field.onChange} /></div><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="assignedTo" render={({ field }) => (
                <FormItem><FormLabel>Assign To</FormLabel><Select onValueChange={(v) => field.onChange([v])} value={field.value?.[0]} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="Recipient" /></SelectTrigger></FormControl><SelectContent><SelectGroup><SelectLabel>Staff</SelectLabel>{availableInternalUsers.map(u => <SelectItem key={u.id} value={`staff:${u.email}`}>{u.name}</SelectItem>)}</SelectGroup><Separator /><SelectGroup><SelectLabel>Partners</SelectLabel>{availableExternalPartners.map(s => <SelectItem key={s.id} value={`partner:${s.email}`}>{s.name}</SelectItem>)}</SelectGroup></SelectContent></Select></FormItem>
              )} />
              <DialogFooter><Button type="submit" disabled={isPending} className="w-full">{isPending ? <Loader2 className="animate-spin" /> : 'Log Request'}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
