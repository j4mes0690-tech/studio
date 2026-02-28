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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Save, Send, ShieldCheck, Clock, Camera, Upload, X, RefreshCw, Sparkles, ClipboardList, CheckSquare } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, Permit, Photo, PermitTemplate, TemplateSection } from '@/lib/types';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn, getProjectInitials, getNextReference } from '@/lib/utils';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const NewPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  contractorId: z.string().min(1, 'Contractor is required.'),
  description: z.string().min(10, 'Details must be at least 10 characters.'),
  validFrom: z.string().min(1, 'Start time is required.'),
  validTo: z.string().min(1, 'Expiry time is required.'),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type NewPermitFormValues = z.infer<typeof NewPermitSchema>;

export function NewPermitDialog({ 
  projects, 
  subContractors, 
  allPermits, 
  currentUser 
}: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allPermits: Permit[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Template State
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [dynamicSections, setDynamicSections] = useState<TemplateSection[]>([]);

  const templatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'permit-templates');
  }, [db]);
  const { data: permitTemplates } = useCollection<PermitTemplate>(templatesQuery);

  const form = useForm<NewPermitFormValues>({
    resolver: zodResolver(NewPermitSchema),
    defaultValues: {
      projectId: '',
      areaId: '',
      type: 'General',
      contractorId: '',
      description: '',
      validFrom: new Date().toISOString().slice(0, 16),
      validTo: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16),
      status: 'issued',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedType = form.watch('type');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  const filteredTemplates = useMemo(() => {
    return (permitTemplates || []).filter(t => t.type === selectedType);
  }, [permitTemplates, selectedType]);

  const handleApplyTemplate = (templateId: string) => {
    const template = permitTemplates?.find(t => t.id === templateId);
    if (template) {
        setActiveTemplateId(templateId);
        form.setValue('description', template.description);
        // Map template sections to local state for interaction
        setDynamicSections(JSON.parse(JSON.stringify(template.sections)));
        toast({ title: 'Dynamic Form Loaded', description: `Standard ${template.type} layout applied.` });
    }
  };

  const updateDynamicValue = (sectionId: string, fieldId: string, value: any) => {
    setDynamicSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return {
                ...s,
                fields: s.fields.map(f => f.id === fieldId ? { ...f, value } : f)
            };
        }
        return s;
    }));
  };

  const onSubmit = (values: NewPermitFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Generating digital permit and uploading media...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `permits/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const typeMap: Record<string, string> = {
          'Hot Work': 'HWP',
          'Confined Space': 'CSP',
          'Excavation': 'EXP',
          'Lifting': 'LIP',
          'General': 'GWP'
        };
        const prefix = typeMap[values.type];
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allPermits.map(p => ({ reference: p.reference, projectId: p.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, prefix, initials);
        
        const contractor = subContractors.find(s => s.id === values.contractorId);

        const permitData: Omit<Permit, 'id'> = {
          reference,
          projectId: values.projectId,
          areaId: values.areaId || null,
          type: values.type,
          contractorId: values.contractorId,
          contractorName: contractor?.name || 'Unknown',
          description: values.description,
          sections: dynamicSections,
          validFrom: new Date(values.validFrom).toISOString(),
          validTo: new Date(values.validTo).toISOString(),
          status: values.status,
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          photos: uploadedPhotos,
        };

        await addDoc(collection(db, 'permits'), permitData);
        toast({ title: 'Success', description: values.status === 'draft' ? 'Permit saved as draft.' : 'Permit issued successfully.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to issue permit.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setDynamicSections([]);
      setActiveTemplateId(null);
      form.reset();
    }
  }, [open, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {}
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhotos([...photos, { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10 px-5 shadow-lg shadow-primary/20">
          <PlusCircle className="h-4.5 w-4.5" />
          New Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle>Issue Electronic Permit</DialogTitle>
              <DialogDescription>Assign trade partner and fill dynamic safety controls.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <Form {...form}>
                <form className="space-y-8">
                    {/* Standard Identity Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="projectId" render={({ field }) => (
                            <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem><FormLabel>Permit Type</FormLabel><Select onValueChange={(val) => { field.onChange(val); setActiveTemplateId(null); setDynamicSections([]); }} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="General">General Works</SelectItem><SelectItem value="Hot Work">Hot Work</SelectItem><SelectItem value="Confined Space">Confined Space</SelectItem><SelectItem value="Excavation">Excavation</SelectItem><SelectItem value="Lifting">Lifting Ops</SelectItem></SelectContent></Select></FormItem>
                        )} />
                        <FormItem>
                            <FormLabel>Apply Digital Template</FormLabel>
                            <Select onValueChange={handleApplyTemplate} value={activeTemplateId || ''}>
                                <FormControl>
                                    <SelectTrigger className="bg-primary/5 border-primary/20 text-primary font-semibold">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList className="h-4 w-4" />
                                            <SelectValue placeholder={filteredTemplates.length > 0 ? "Select template..." : "No templates for this type"} />
                                        </div>
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {filteredTemplates.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="contractorId" render={({ field }) => (
                            <FormItem><FormLabel>Instructed Trade Partner</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger></FormControl><SelectContent>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="areaId" render={({ field }) => (
                            <FormItem><FormLabel>Location / Plot</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="General Site" /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center justify-between"><FormLabel>Work Description</FormLabel><VoiceInput onResult={field.onChange} /></div>
                            <FormControl><Textarea placeholder="Specific task details..." className="min-h-[80px]" {...field} /></FormControl>
                        </FormItem>
                    )} />

                    <Separator />

                    {/* DYNAMIC SECTIONS: Replicated from source document via AI */}
                    {dynamicSections.length > 0 ? (
                        <div className="space-y-10">
                            {dynamicSections.map((section) => (
                                <div key={section.id} className="space-y-4 animate-in fade-in duration-500">
                                    <h4 className="font-bold text-xs uppercase tracking-widest text-primary bg-primary/5 p-2 rounded border-l-4 border-primary">
                                        {section.title}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                        {section.fields.map((field) => (
                                            <div key={field.id} className={cn(
                                                "flex flex-col gap-2 p-3 rounded-lg border",
                                                field.type === 'checkbox' ? 'flex-row-reverse items-center justify-between' : ''
                                            )}>
                                                {field.type === 'checkbox' ? (
                                                    <>
                                                        <Checkbox 
                                                            id={field.id} 
                                                            checked={!!field.value} 
                                                            onCheckedChange={(val) => updateDynamicValue(section.id, field.id, !!val)} 
                                                        />
                                                        <Label htmlFor={field.id} className="text-sm font-medium leading-tight cursor-pointer">{field.label}</Label>
                                                    </>
                                                ) : field.type === 'textarea' ? (
                                                    <>
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{field.label}</Label>
                                                        <Textarea 
                                                            value={(field.value as string) || ''} 
                                                            onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)}
                                                            className="min-h-[60px]"
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <Label className="text-[10px] font-black uppercase text-muted-foreground">{field.label}</Label>
                                                        <Input 
                                                            value={(field.value as string) || ''} 
                                                            onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center border-2 border-dashed rounded-lg bg-muted/5">
                            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                            <p className="text-sm text-muted-foreground">Select a dynamic template to load specialized safety controls.</p>
                        </div>
                    )}

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="validFrom" render={({ field }) => (
                            <FormItem><FormLabel>Valid From</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="validTo" render={({ field }) => (
                            <FormItem><FormLabel>Expiry Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-4">
                        <FormLabel>Visual Evidence & Media</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-24 h-24">
                                    <Image src={p.url} alt="Permit" fill className="rounded-md object-cover border" />
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
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 gap-3">
            <Button variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={form.handleSubmit(v => onSubmit({...v, status: 'draft'}))}>
                <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
            <Button className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={form.handleSubmit(v => onSubmit({...v, status: 'issued'}))}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Issue Permit
            </Button>
        </DialogFooter>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}