'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
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
  Camera, 
  X, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Layout,
  MapPin,
  Calendar as CalendarIcon
} from 'lucide-react';
import type { 
  Project, 
  SubContractor, 
  DistributionUser, 
  Permit, 
  Photo, 
  PermitTemplate, 
  TemplateSection, 
  TemplateField 
} from '@/lib/types';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn, getProjectInitials, getNextReference, scrollToFirstError } from '@/lib/utils';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { CameraOverlay } from '@/components/camera-overlay';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const NewPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  customAreaName: z.string().optional(),
  templateId: z.string().min(1, 'Selecting a permit template is required.'),
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
  const [dynamicSections, setDynamicSections] = useState<TemplateSection[]>([]);
  
  // Track which dynamic field is calling the camera
  const [activePhotoFieldId, setActivePhotoFieldId] = useState<{ sectionId: string, fieldId: string } | null>(null);

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
      customAreaName: '',
      templateId: '',
      contractorId: '',
      description: '',
      validFrom: new Date().toISOString().slice(0, 16),
      validTo: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16),
      status: 'issued',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedAreaId = form.watch('areaId');
  const selectedTemplateId = form.watch('templateId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  const handleApplyTemplate = (templateId: string) => {
    const template = permitTemplates?.find(t => t.id === templateId);
    if (template) {
        form.setValue('description', template.description);
        setDynamicSections(JSON.parse(JSON.stringify(template.sections)));
    }
  };

  const addSection = () => {
    const newSection: TemplateSection = { id: `section-${Date.now()}`, title: 'Additional Controls', fields: [] };
    setDynamicSections([...dynamicSections, newSection]);
  };

  const addField = (sectionId: string) => {
    const newField: TemplateField = { id: `field-${Date.now()}`, label: 'Verification Item', type: 'checkbox', value: false };
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
    const template = permitTemplates?.find(t => t.id === values.templateId);
    if (!template) return;

    startTransition(async () => {
      try {
        // Upload global photos
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

        // Upload field-specific photos
        const processedSections = await Promise.all(dynamicSections.map(async (section) => {
            const processedFields = await Promise.all(section.fields.map(async (field) => {
                if (field.type === 'photo' && field.value && field.value.url?.startsWith('data:')) {
                    const blob = await dataUriToBlob(field.value.url);
                    const url = await uploadFile(storage, `permits/fields/${field.id}-${Date.now()}.jpg`, blob);
                    return { ...field, value: { ...field.value, url } };
                }
                return field;
            }));
            return { ...section, fields: processedFields };
        }));

        const typeMap: Record<string, string> = { 'Hot Work': 'HWP', 'Confined Space': 'CSP', 'Excavation': 'EXP', 'Lifting': 'LIP', 'General': 'GWP' };
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allPermits.map(p => ({ reference: p.reference, projectId: p.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, typeMap[template.type] || 'PRM', initials);
        const contractor = subContractors.find(s => s.id === values.contractorId);

        const permitData: Omit<Permit, 'id'> = {
          reference,
          projectId: values.projectId,
          areaId: values.areaId === 'other' ? null : (values.areaId || null),
          customAreaName: values.areaId === 'other' ? (values.customAreaName || null) : null,
          type: template.type,
          contractorId: values.contractorId,
          contractorName: contractor?.name || 'Unknown',
          description: values.description,
          sections: processedSections,
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

  const onCapture = (photo: Photo) => {
    if (activePhotoFieldId) {
        updateDynamicValue(activePhotoFieldId.sectionId, activePhotoFieldId.fieldId, photo);
        setActivePhotoFieldId(null);
    } else {
        setPhotos(prev => [...prev, photo]);
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setDynamicSections([]);
      setActivePhotoFieldId(null);
      form.reset();
    }
  }, [open, form]);

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10 px-5 shadow-lg shadow-primary/20 font-bold">
          <PlusCircle className="h-4 w-4" />
          Issue Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogTitle>Issue Electronic Permit</DialogTitle>
              <DialogDescription>Select a standard template to initialize the safety controls for this task.</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-2 border-primary/20 text-primary h-9">
                    <Plus className="h-4 w-4" /> Add Custom Section
                </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/5">
            <Form {...form}>
                <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="templateId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Permit Type (Template)</FormLabel>
                                    <Select onValueChange={(val) => { field.onChange(val); handleApplyTemplate(val); }} value={field.value}>
                                        <FormControl><SelectTrigger className="border-primary/20 bg-primary/5"><SelectValue placeholder="Select standard template" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {permitTemplates?.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.title} ({t.type})</SelectItem>
                                            ))}
                                            {(!permitTemplates || permitTemplates.length === 0) && (
                                                <SelectItem value="none" disabled>No templates defined in Settings</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="contractorId" render={({ field }) => (
                                <FormItem><FormLabel>Trade Partner</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger></FormControl><SelectContent>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <div className="space-y-4">
                                <FormField control={form.control} name="areaId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Location / Plot</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="General Site" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="site-wide">General Site</SelectItem>
                                                {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                                <Separator className="my-1" />
                                                <SelectItem value="other">Other / Not Listed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                {selectedAreaId === 'other' && (
                                    <FormField control={form.control} name="customAreaName" render={({ field }) => (
                                        <FormItem className="animate-in fade-in slide-in-from-top-1">
                                            <FormLabel className="text-primary font-bold">Specify Custom Location</FormLabel>
                                            <FormControl><Input placeholder="e.g. Roof Plant Room Area B" {...field} className="bg-background" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><div className="flex justify-between items-center"><FormLabel>Work Description</FormLabel><VoiceInput onResult={field.onChange} /></div><FormControl><Textarea placeholder="Specific task details..." className="min-h-[80px]" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <Accordion type="multiple" defaultValue={dynamicSections.map(s => s.id)} className="space-y-4">
                        {dynamicSections.map((section) => (
                            <AccordionItem key={section.id} value={section.id} className="border bg-background rounded-xl overflow-hidden shadow-sm">
                                <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-muted/5 group">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-2">
                                            <Layout className="h-4 w-4 text-primary" />
                                            <span className="font-bold text-xs uppercase tracking-widest text-primary">{section.title}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); addField(section.id); }} className="h-8 text-[10px] uppercase font-bold text-primary"><Plus className="h-3 w-3 mr-1" /> Add Field</Button>
                                            <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDynamicSections(dynamicSections.filter(s => s.id !== section.id)); }} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {section.fields.map((field) => (
                                            <div key={field.id} className={cn(
                                                "bg-background p-4 rounded-xl border shadow-sm relative group/field",
                                                field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                            )}>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <Label className="text-xs font-bold leading-relaxed">{field.label}</Label>
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover/field:opacity-100" onClick={() => setDynamicSections(dynamicSections.map(s => s.id === section.id ? { ...s, fields: s.fields.filter(f => f.id !== field.id) } : s))}><X className="h-3 w-3" /></Button>
                                                    </div>
                                                    
                                                    <div className="pt-1">
                                                        {field.type === 'checkbox' && (
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox checked={!!field.value} onCheckedChange={(val) => updateDynamicValue(section.id, field.id, !!val)} />
                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Verified</span>
                                                            </div>
                                                        )}
                                                        {field.type === 'yes-no-na' && (
                                                            <RadioGroup value={field.value || ""} onValueChange={(val) => updateDynamicValue(section.id, field.id, val)} className="flex items-center gap-4">
                                                                <div className="flex items-center space-x-1.5"><RadioGroupItem value="yes" id={`y-${field.id}`} /><Label htmlFor={`y-${field.id}`} className="text-[10px]">Yes</Label></div>
                                                                <div className="flex items-center space-x-1.5"><RadioGroupItem value="no" id={`n-${field.id}`} /><Label htmlFor={`n-${field.id}`} className="text-[10px]">No</Label></div>
                                                                <div className="flex items-center space-x-1.5"><RadioGroupItem value="na" id={`na-${field.id}`} /><Label htmlFor={`na-${field.id}`} className="text-[10px]">N/A</Label></div>
                                                            </RadioGroup>
                                                        )}
                                                        {field.type === 'text' && (
                                                            <Input className="h-9 text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                        )}
                                                        {field.type === 'textarea' && (
                                                            <Textarea className="min-h-[60px] text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                        )}
                                                        {field.type === 'date' && (
                                                            <div className="flex items-center gap-2">
                                                                <CalendarIcon className="h-4 w-4 text-primary" />
                                                                <Input type="date" className="h-9 text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                            </div>
                                                        )}
                                                        {field.type === 'photo' && (
                                                            <div className="space-y-2">
                                                                <div className="flex gap-2">
                                                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-2 text-[10px] font-bold" onClick={() => { setActivePhotoFieldId({ sectionId: section.id, fieldId: field.id }); setIsCameraOpen(true); }}>
                                                                        <Camera className="h-3.5 w-3.5" /> Capture Photo
                                                                    </Button>
                                                                    {field.value && (
                                                                        <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => updateDynamicValue(section.id, field.id, null)}>
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                {field.value && (
                                                                    <div className="relative w-20 h-16 rounded border overflow-hidden">
                                                                        <Image src={field.value.url} alt="Field verification" fill className="object-cover" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormField control={form.control} name="validFrom" render={({ field }) => (
                            <FormItem><FormLabel>Activity Start</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="validTo" render={({ field }) => (
                            <FormItem><FormLabel>Activity Expiry</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
                        )} />
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                        <FormLabel>Visual Verification Photos (General)</FormLabel>
                        <div className="flex flex-wrap gap-3">
                            {photos.map((p, i) => (
                                <div key={i} className="relative w-24 h-24 group"><Image src={p.url} alt="Permit" fill className="rounded-xl object-cover border-2" /><Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button></div>
                            ))}
                            <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => { setActivePhotoFieldId(null); setIsCameraOpen(true); }}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase">Capture</span></Button>
                        </div>
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0 gap-3">
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setOpen(false)} disabled={isPending}>Discard</Button>
            <Button variant="outline" className="w-full sm:w-auto h-12 font-bold" disabled={isPending} onClick={form.handleSubmit(v => onSubmit({...v, status: 'draft'}), () => scrollToFirstError())}><Save className="mr-2 h-4 w-4" /> Save Draft</Button>
            <Button className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending || !selectedTemplateId} onClick={form.handleSubmit(v => onSubmit({...v, status: 'issued'}), () => scrollToFirstError())}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}Issue Electronic Permit</Button>
        </DialogFooter>
      </DialogContent>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture} 
        title={activePhotoFieldId ? "Verification Field Documentation" : "General Permit Evidence"}
      />
    </Dialog>
  );
}
