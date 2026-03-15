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
import { 
  PlusCircle, 
  Loader2, 
  Save, 
  Send, 
  ShieldCheck, 
  Clock, 
  Camera, 
  Upload, 
  X, 
  RefreshCw, 
  Sparkles, 
  ClipboardList, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Layout 
} from 'lucide-react';
import type { 
  Project, 
  SubContractor, 
  DistributionUser, 
  Permit, 
  Photo, 
  PermitTemplate, 
  TemplateSection, 
  TemplateField, 
  TemplateFieldType 
} from '@/lib/types';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CameraOverlay } from '@/components/camera-overlay';
import { replicatePermitTemplate } from '@/ai/flows/replicate-permit-template';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [dynamicSections, setDynamicSections] = useState<TemplateSection[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

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
        setDynamicSections(JSON.parse(JSON.stringify(template.sections)));
        toast({ title: 'Standard Template Loaded', description: `Controls for ${template.title} applied.` });
    }
  };

  const handleSmartReplication = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    toast({ title: "Replicator Waking Up", description: "AI is mapping the structure of your document..." });
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        try {
          const result = await replicatePermitTemplate({ fileDataUri: dataUri });
          if (result) {
            form.setValue('title', result.title as any);
            form.setValue('type', result.type);
            form.setValue('description', result.description);
            setDynamicSections(result.sections);
            toast({ title: "Replication Complete", description: `Generated ${result.sections.length} custom sections.` });
          }
        } catch (err) {
          toast({ title: "Wizard Failed", description: "Could not replicate this document structure.", variant: "destructive" });
        } finally {
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsExtracting(false);
    }
  };

  const addSection = () => {
    const newSection: TemplateSection = { id: `section-${Date.now()}`, title: 'New Safety Section', fields: [] };
    setDynamicSections([...dynamicSections, newSection]);
  };

  const addField = (sectionId: string) => {
    const newField: TemplateField = { id: `field-${Date.now()}`, label: 'New Check Item', type: 'checkbox', value: false };
    setDynamicSections(dynamicSections.map(s => s.id === sectionId ? { ...s, fields: [...s.fields, newField] } : s));
  };

  const updateDynamicValue = (sectionId: string, fieldId: string, value: any) => {
    setDynamicSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, value } : f) };
        }
        return s;
    }));
  };

  const onSubmit = (values: NewPermitFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Persisting digital permit and media...' });

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

        const typeMap: Record<string, string> = { 'Hot Work': 'HWP', 'Confined Space': 'CSP', 'Excavation': 'EXP', 'Lifting': 'LIP', 'General': 'GWP' };
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allPermits.map(p => ({ reference: p.reference, projectId: p.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, typeMap[values.type], initials);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10 px-5 shadow-lg shadow-primary/20">
          <PlusCircle className="h-4 w-4" />
          New Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle>Issue Electronic Permit</DialogTitle>
              <DialogDescription>Apply a standard template or build a custom layout for this task.</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-2 border-primary/20 text-primary h-9">
                    <Plus className="h-4 w-4" /> Add Section
                </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/5">
            <div className="bg-gradient-to-br from-primary/10 to-background border-2 border-primary/20 rounded-xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"><Sparkles className="h-24 w-24 text-primary" /></div>
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-bold text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Smart Replication</h3>
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">Upload a scan or photo of your existing paper permit to digitize its structure instantly.</p>
                    </div>
                    <input type="file" ref={templateInputRef} className="hidden" accept="image/*,.pdf" onChange={handleSmartReplication} />
                    <Button type="button" className="w-full sm:w-auto h-11 px-6 font-bold gap-2" onClick={() => templateInputRef.current?.click()} disabled={isExtracting}>
                        {isExtracting ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</> : <><Upload className="h-4 w-4" />Replicate Existing Form</>}
                    </Button>
                </div>
            </div>

            <Form {...form}>
                <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem><FormLabel>Permit Type</FormLabel><Select onValueChange={(val) => { field.onChange(val); setActiveTemplateId(null); setDynamicSections([]); }} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="General">General Works</SelectItem><SelectItem value="Hot Work">Hot Work</SelectItem><SelectItem value="Confined Space">Confined Space</SelectItem><SelectItem value="Excavation">Excavation</SelectItem><SelectItem value="Lifting">Lifting Ops</SelectItem></SelectContent></Select></FormItem>
                            )} />
                            <FormItem><FormLabel>Start from Template</FormLabel><Select onValueChange={handleApplyTemplate} value={activeTemplateId || ''}><FormControl><SelectTrigger className="bg-primary/5 border-primary/20 text-primary font-semibold"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><SelectValue placeholder={filteredTemplates.length > 0 ? "Select template..." : "No templates"} /></div></SelectTrigger></FormControl><SelectContent>{filteredTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></FormItem>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="contractorId" render={({ field }) => (
                                <FormItem><FormLabel>Trade Partner</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger></FormControl><SelectContent>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem><FormLabel>Location / Plot</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="General Site" /></SelectTrigger></FormControl><SelectContent>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><div className="flex items-center justify-between"><FormLabel>Work Description</FormLabel><VoiceInput onResult={field.onChange} /></div><FormControl><Textarea placeholder="Specific task details..." className="min-h-[80px]" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    {dynamicSections.map((section) => (
                        <div key={section.id} className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between group/header">
                                <div className="flex items-center gap-2 flex-1 mr-4"><Layout className="h-4 w-4 text-primary" /><Input value={section.title} onChange={(e) => setDynamicSections(dynamicSections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))} className="bg-transparent border-transparent hover:border-border font-bold text-xs uppercase tracking-widest text-primary h-8" /></div>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => addField(section.id)} className="h-8 text-[10px] uppercase font-bold text-primary"><Plus className="h-3 w-3 mr-1" /> Add Field</Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setDynamicSections(dynamicSections.filter(s => s.id !== section.id))} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {section.fields.map((field) => (
                                    <div key={field.id} className="bg-background p-4 rounded-xl border shadow-sm relative group/field">
                                        <Button type="button" variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 bg-background border shadow-sm opacity-0 group-hover/field:opacity-100 text-destructive" onClick={() => setDynamicSections(dynamicSections.map(s => s.id === section.id ? { ...s, fields: s.fields.filter(f => f.id !== field.id) } : s))}><X className="h-3 w-3" /></Button>
                                        <div className="space-y-3">
                                            <Input value={field.label} onChange={(e) => setDynamicSections(dynamicSections.map(s => s.id === section.id ? { ...s, fields: s.fields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f) } : s))} className="h-7 text-xs font-semibold bg-muted/30 border-transparent" />
                                            <div className="pt-2 border-t border-dashed">
                                                {field.type === 'checkbox' ? <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground font-bold">Toggle Check</span><Checkbox checked={!!field.value} onCheckedChange={(val) => updateDynamicValue(section.id, field.id, !!val)} /></div> : <span className="text-[10px] text-muted-foreground uppercase">{field.type} Field</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormField control={form.control} name="validFrom" render={({ field }) => (
                            <FormItem><FormLabel>Activity Start</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="validTo" render={({ field }) => (
                            <FormItem><FormLabel>Activity Expiry</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormLabel>Visual Verification Photos</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-24 h-24 group"><Image src={p.url} alt="Permit" fill className="rounded-xl object-cover border-2" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>
                            ))}
                            <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase">Capture</span></Button>
                        </div>
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0 gap-3">
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)} disabled={isPending}>Discard</Button>
            <Button variant="outline" className="w-full sm:w-auto h-12 font-bold" disabled={isPending} onClick={form.handleSubmit(v => onSubmit({...v, status: 'draft'}))}><Save className="mr-2 h-4 w-4" /> Save Draft</Button>
            <Button className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending} onClick={form.handleSubmit(v => onSubmit({...v, status: 'issued'}))}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}Issue Electronic Permit</Button>
        </DialogFooter>
      </DialogContent>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
        title="Permit Site Evidence"
      />
    </Dialog>
  );
}
