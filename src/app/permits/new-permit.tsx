'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from '@/components/ui/label';
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
  Layout,
  Calendar as CalendarIcon,
  Upload
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
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { CameraOverlay } from '@/components/camera-overlay';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';

const NewPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  customAreaName: z.string().optional(),
  templateId: z.string().min(1, 'Selecting a permit template is required.'),
  contractorId: z.string().min(1, 'Contractor is required.'),
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

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [dynamicSections, setDynamicSections] = useState<TemplateSection[]>([]);
  const [activePhotoFieldId, setActivePhotoFieldId] = useState<{ sectionId: string, fieldId: string } | null>(null);
  const fieldFileInputRef = useRef<HTMLInputElement>(null);

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
        setDynamicSections(JSON.parse(JSON.stringify(template.sections)));
    }
  };

  const updateDynamicValue = (sectionId: string, fieldId: string, value: any) => {
    setDynamicSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, value } : f) };
        }
        return s;
    }));
  };

  const onCapture = (photo: Photo) => {
    if (activePhotoFieldId) {
        setDynamicSections(prev => prev.map(s => {
            if (s.id === activePhotoFieldId.sectionId) {
                return { 
                    ...s, 
                    fields: s.fields.map(f => {
                        if (f.id === activePhotoFieldId.fieldId) {
                            const currentPhotos = Array.isArray(f.value) ? f.value : [];
                            return { ...f, value: [...currentPhotos, photo] };
                        }
                        return f;
                    }) 
                };
            }
            return s;
        }));
        setActivePhotoFieldId(null);
    }
    setIsCameraOpen(false);
  };

  const handleFieldFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !activePhotoFieldId) return;
    
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photo = { url: event.target?.result as string, takenAt: new Date().toISOString() };
        setDynamicSections(prev => prev.map(s => {
            if (s.id === activePhotoFieldId!.sectionId) {
                return { 
                    ...s, 
                    fields: s.fields.map(f => {
                        if (f.id === activePhotoFieldId!.fieldId) {
                            const currentPhotos = Array.isArray(f.value) ? f.value : [];
                            return { ...f, value: [...currentPhotos, photo] };
                        }
                        return f;
                    }) 
                };
            }
            return s;
        }));
      };
      reader.readAsDataURL(f);
    });
    // Clear the input so same file can be selected again if needed
    e.target.value = '';
  };

  const onSubmit = (values: NewPermitFormValues, status: 'draft' | 'issued') => {
    const template = permitTemplates?.find(t => t.id === values.templateId);
    if (!template) return;

    startTransition(async () => {
      try {
        // Upload field-specific photos
        const processedSections = await Promise.all(dynamicSections.map(async (section) => {
            const processedFields = await Promise.all(section.fields.map(async (field) => {
                if (field.type === 'photo' && Array.isArray(field.value)) {
                    const uploadedPhotos = await Promise.all(field.value.map(async (p, pi) => {
                        if (p.url.startsWith('data:')) {
                            const blob = await dataUriToBlob(p.url);
                            const url = await uploadFile(storage, `permits/fields/${field.id}-${Date.now()}-${pi}.jpg`, blob);
                            return { ...p, url };
                        }
                        return p;
                    }));
                    return { ...field, value: uploadedPhotos };
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

        const now = new Date();
        const expiry = new Date(now.getTime() + 8 * 60 * 60 * 1000);

        const permitData: Omit<Permit, 'id'> = {
          reference,
          projectId: values.projectId,
          areaId: values.areaId === 'other' ? null : (values.areaId || null),
          customAreaName: values.areaId === 'other' ? (values.customAreaName || null) : null,
          type: template.type,
          contractorId: values.contractorId,
          contractorName: contractor?.name || 'Unknown',
          description: template.title,
          sections: processedSections,
          validFrom: now.toISOString(),
          validTo: expiry.toISOString(),
          status: status,
          createdAt: now.toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          photos: [],
        };

        await addDoc(collection(db, 'permits'), permitData);
        toast({ title: 'Success', description: status === 'draft' ? 'Permit saved as draft.' : 'Permit issued successfully.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to issue permit.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setDynamicSections([]);
      setActivePhotoFieldId(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 h-10 px-5 shadow-lg shadow-primary/20 font-bold">
          <PlusCircle className="h-4 w-4" />
          Issue Permit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <div>
            <DialogTitle>Issue Electronic Permit</DialogTitle>
            <DialogDescription>Apply a master safety template to a contractor and work area.</DialogDescription>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(() => {}, () => scrollToFirstError())} 
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8 bg-muted/5">
                <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="projectId" render={({ field }) => (
                            <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <FormField control={form.control} name="templateId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Permit Template</FormLabel>
                                <Select onValueChange={(val) => { field.onChange(val); handleApplyTemplate(val); }} value={field.value}>
                                    <FormControl><SelectTrigger className="border-primary/20 bg-primary/5"><SelectValue placeholder="Select standard template" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {permitTemplates?.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                        ))}
                                        {(!permitTemplates || permitTemplates.length === 0) && (
                                            <SelectItem value="none" disabled>No templates defined in Form Editor</SelectItem>
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
                </div>

                <Accordion type="multiple" defaultValue={dynamicSections.map(s => s.id)} className="space-y-4">
                    {dynamicSections.map((section) => (
                        <AccordionItem key={section.id} value={section.id} className="border bg-background rounded-xl overflow-hidden shadow-sm">
                            <AccordionTrigger className="px-6 py-3 hover:no-underline hover:bg-muted/5 group border-none">
                                <div className="flex items-center gap-2">
                                    <Layout className="h-4 w-4 text-primary" />
                                    <span className="font-bold text-xs uppercase tracking-widest text-primary">{section.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 py-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className={cn(
                                            "bg-background p-4 rounded-xl border shadow-sm relative group/field",
                                            field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                        )}>
                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold leading-relaxed">{field.label}</Label>
                                                
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
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="h-8 gap-2 text-[10px] font-bold" 
                                                                    onClick={() => { setActivePhotoFieldId({ sectionId: section.id, fieldId: field.id }); setIsCameraOpen(true); }}
                                                                >
                                                                    <Camera className="h-3.5 w-3.5" /> Camera
                                                                </Button>
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="h-8 gap-2 text-[10px] font-bold" 
                                                                    onClick={() => { setActivePhotoFieldId({ sectionId: section.id, fieldId: field.id }); fieldFileInputRef.current?.click(); }}
                                                                >
                                                                    <Upload className="h-3.5 w-3.5" /> Upload
                                                                </Button>
                                                            </div>
                                                            
                                                            {field.value && Array.isArray(field.value) && field.value.length > 0 && (
                                                              <div className="flex flex-wrap gap-2 pt-1">
                                                                {field.value.map((p: Photo, pIdx: number) => (
                                                                  <div key={pIdx} className="relative w-16 h-12 rounded border bg-muted overflow-hidden group/thumb">
                                                                    <Image src={p.url} alt="Verification" fill className="object-cover" />
                                                                    <button 
                                                                      type="button" 
                                                                      className="absolute top-0 right-0 bg-destructive text-white p-0.5 shadow-sm transition-opacity" 
                                                                      onClick={() => {
                                                                        const updatedPhotos = field.value.filter((_: any, i: number) => i !== pIdx);
                                                                        updateDynamicValue(section.id, field.id, updatedPhotos);
                                                                      }}
                                                                    >
                                                                      <X className="h-3 w-3" />
                                                                    </button>
                                                                  </div>
                                                                ))}
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

                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t pb-10">
                    <Button variant="ghost" className="font-bold text-muted-foreground order-last sm:order-first" onClick={() => setOpen(false)} disabled={isPending}>Discard</Button>
                    <div className="hidden sm:block flex-1" />
                    <Button variant="outline" className="w-full sm:w-auto h-12 font-bold gap-2" disabled={isPending} onClick={form.handleSubmit(v => onSubmit(v, 'draft'), () => scrollToFirstError())}><Save className="mr-2 h-4 w-4" /> Save as Draft</Button>
                    <Button className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" disabled={isPending || !selectedTemplateId} onClick={form.handleSubmit(v => onSubmit(v, 'issued'), () => scrollToFirstError())}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}Save</Button>
                </div>
              </div>
            </div>
            <input type="file" ref={fieldFileInputRef} className="hidden" accept="image/*" multiple onChange={handleFieldFileSelect} />
          </form>
        </Form>
      </DialogContent>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture} 
        title="Verification Documentation"
      />
    </Dialog>
  );
}
