
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Send, ShieldCheck, Clock, Camera, Upload, X, RefreshCw } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, Permit, Photo } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';

const EditPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  contractorId: z.string().min(1, 'Contractor is required.'),
  description: z.string().min(10, 'Details must be at least 10 characters.'),
  hazards: z.string().min(1, 'Identify at least one hazard.'),
  precautions: z.string().min(1, 'Identify at least one precaution.'),
  validFrom: z.string().min(1, 'Start time is required.'),
  validTo: z.string().min(1, 'Expiry time is required.'),
  status: z.enum(['draft', 'issued', 'closed', 'cancelled']).default('issued'),
});

type EditPermitFormValues = z.infer<typeof EditPermitSchema>;

export function EditPermitDialog({ 
  permit,
  projects, 
  subContractors, 
  allPermits, 
  currentUser,
  open,
  onOpenChange
}: { 
  permit: Permit;
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allPermits: Permit[];
  currentUser: DistributionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>(permit.photos || []);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditPermitFormValues>({
    resolver: zodResolver(EditPermitSchema),
    defaultValues: {
      projectId: permit.projectId,
      areaId: permit.areaId || '',
      type: permit.type,
      contractorId: permit.contractorId,
      description: permit.description,
      hazards: permit.hazards,
      precautions: permit.precautions,
      validFrom: new Date(permit.validFrom).toISOString().slice(0, 16),
      validTo: new Date(permit.validTo).toISOString().slice(0, 16),
      status: permit.status,
    },
  });

  useEffect(() => {
    if (open && permit) {
      form.reset({
        projectId: permit.projectId,
        areaId: permit.areaId || '',
        type: permit.type,
        contractorId: permit.contractorId,
        description: permit.description,
        hazards: permit.hazards,
        precautions: permit.precautions,
        validFrom: new Date(permit.validFrom).toISOString().slice(0, 16),
        validTo: new Date(permit.validTo).toISOString().slice(0, 16),
        status: permit.status,
      });
      setPhotos(permit.photos || []);
    }
  }, [open, permit, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  const onSubmit = (values: EditPermitFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Updating', description: 'Persisting changes and media...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `permits/photos/${permit.id}-${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const contractor = subContractors.find(s => s.id === values.contractorId);
        const docRef = doc(db, 'permits', permit.id);
        const updates: any = {
          projectId: values.projectId,
          areaId: values.areaId || null,
          type: values.type,
          contractorId: values.contractorId,
          contractorName: contractor?.name || permit.contractorName,
          description: values.description,
          hazards: values.hazards,
          precautions: values.precautions,
          validFrom: new Date(values.validFrom).toISOString(),
          validTo: new Date(values.validTo).toISOString(),
          status: values.status,
          photos: uploadedPhotos,
        };

        if (values.status === 'closed' && permit.status !== 'closed') {
            updates.closedAt = new Date().toISOString();
            updates.closedByEmail = currentUser.email;
        }

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Permit updated.' });
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update permit.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {}
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhotos([...photos, { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Permit: {permit.reference}</DialogTitle>
          <DialogDescription>Modify hazard controls or validity periods.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('status')} />
            
            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="projectId" render={({ field }) => (
                        <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="areaId" render={({ field }) => (
                        <FormItem><FormLabel>Area / Plot</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="General Site" /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem><FormLabel>Permit Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="General">General Works</SelectItem><SelectItem value="Hot Work">Hot Work</SelectItem><SelectItem value="Confined Space">Confined Space</SelectItem><SelectItem value="Excavation">Excavation</SelectItem><SelectItem value="Lifting">Lifting Ops</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="contractorId" render={({ field }) => (
                        <FormItem><FormLabel>Contractor / Party</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Work Description</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl></FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="hazards" render={({ field }) => (
                        <FormItem><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-destructive" /><FormLabel>Hazards</FormLabel></div><FormControl><Textarea className="min-h-[80px] bg-destructive/5" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="precautions" render={({ field }) => (
                        <FormItem><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><FormLabel>Safety Controls</FormLabel></div><FormControl><Textarea className="min-h-[80px] bg-primary/5" {...field} /></FormControl></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="validFrom" render={({ field }) => (
                        <FormItem><FormLabel>Valid From</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="validTo" render={({ field }) => (
                        <FormItem><FormLabel>Valid Until</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                    )} />
                </div>

                <div className="space-y-4">
                    <FormLabel>Permit Evidence & Photos</FormLabel>
                    <div className="flex flex-wrap gap-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative w-24 h-24">
                                <Image src={p.url} alt="Evidence" fill className="rounded-md object-cover border" />
                                <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-1 border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6" /><span className="text-[10px]">Photo</span></Button>
                    </div>
                    {isCameraOpen && (
                        <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                            <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                            <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={capturePhoto}>Capture</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t gap-3">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={() => form.setValue('status', 'issued')}>
                {isPending && (submissionStatus === 'issued' || submissionStatus === 'closed') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Commit Changes
              </Button>
            </DialogFooter>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                Array.from(files).forEach(f => {
                    const reader = new FileReader();
                    reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                    reader.readAsDataURL(f);
                });
            }} />
            <canvas ref={canvasRef} className="hidden" />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
