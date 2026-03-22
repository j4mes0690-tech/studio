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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ShieldCheck, Clock, Camera, Upload, X, RefreshCw, Layout, Calendar as CalendarIcon, Check } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, Permit, Photo, TemplateSection } from '@/lib/types';
import { useFirestore, useStorage, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { cn, scrollToFirstError } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CameraOverlay } from '@/components/camera-overlay';

const EditPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  customAreaName: z.string().optional(),
  contractorId: z.string().min(1, 'Contractor is required.'),
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

  const [dynamicSections, setDynamicSections] = useState<TemplateSection[]>(permit.sections || []);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activePhotoFieldId, setActivePhotoFieldId] = useState<{ sectionId: string, fieldId: string } | null>(null);
  const fieldFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditPermitFormValues>({
    resolver: zodResolver(EditPermitSchema),
    defaultValues: {
      projectId: permit.projectId,
      areaId: permit.areaId || '',
      customAreaName: permit.customAreaName || '',
      contractorId: permit.contractorId,
      status: permit.status,
    },
  });

  useEffect(() => {
    if (open && permit) {
      form.reset({
        projectId: permit.projectId,
        areaId: permit.areaId || '',
        customAreaName: permit.customAreaName || '',
        contractorId: permit.contractorId,
        status: permit.status,
      });
      setDynamicSections(permit.sections || []);
    }
  }, [open, permit, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedAreaId = form.watch('areaId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

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
    e.target.value = '';
  };

  const validateRequiredFields = () => {
    let missing: string[] = [];
    dynamicSections.forEach(s => {
        s.fields.forEach(f => {
            if (f.required) {
                const hasValue = f.type === 'photo' 
                    ? (Array.isArray(f.value) && f.value.length > 0) 
                    : (f.type === 'checkbox' ? f.value === true : !!f.value);
                if (!hasValue) missing.push(f.label);
            }
        });
    });
    return missing;
  };

  const onSubmit = (values: EditPermitFormValues, targetStatus: 'draft' | 'issued' | 'closed') => {
    if (targetStatus === 'issued') {
        const missing = validateRequiredFields();
        if (missing.length > 0) {
            toast({ 
                title: "Mandatory Fields Missing", 
                description: `Please complete: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '...' : ''}`, 
                variant: "destructive" 
            });
            return;
        }
    }

    startTransition(async () => {
      try {
        toast({ title: 'Updating', description: 'Persisting changes...' });

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

        const contractor = subContractors.find(s => s.id === values.contractorId);
        const docRef = doc(db, 'permits', permit.id);
        const updates: any = {
          projectId: values.projectId,
          areaId: values.areaId === 'other' ? null : (values.areaId || null),
          customAreaName: values.areaId === 'other' ? (values.customAreaName || null) : null,
          contractorId: values.contractorId,
          contractorName: contractor?.name || permit.contractorName,
          status: targetStatus,
          sections: processedSections,
        };

        if (targetStatus === 'closed' && permit.status !== 'closed') {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/10 border-b shrink-0">
          <DialogTitle>Edit Permit: {permit.reference}</DialogTitle>
          <DialogDescription>Modify hazard controls or validity periods.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8 bg-muted/5">
                <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="projectId" render={({ field }) => (
                            <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                        <div className="space-y-4">
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem><FormLabel>Area / Plot</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="General Site" /></SelectTrigger></FormControl><SelectContent><SelectItem value="site-wide">General Site</SelectItem>{availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}<Separator className="my-1" /><SelectItem value="other">Other / Manual Entry</SelectItem></SelectContent></Select></FormItem>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="contractorId" render={({ field }) => (
                            <FormItem><FormLabel>Contractor / Party</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder={projectSubs.length > 0 ? "Select contractor" : "No partners assigned to project"} /></SelectTrigger></FormControl><SelectContent>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                        )} />
                    </div>
                </div>

                <Accordion type="multiple" defaultValue={dynamicSections.map(s => s.id)} className="space-y-4">
                    {dynamicSections.map((section) => (
                        <AccordionItem key={section.id} value={section.id} className="border bg-background rounded-xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-6 bg-muted/5 group">
                                <div className="flex items-center gap-2 py-3">
                                    <Layout className="h-4 w-4 text-primary" />
                                    <span className="font-bold text-xs uppercase tracking-widest text-primary">{section.title}</span>
                                </div>
                                <AccordionTrigger className="w-10 h-10 p-0 hover:no-underline border-none shadow-none" />
                            </div>
                            <AccordionContent className="px-6 py-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className={cn(
                                            "bg-background p-4 rounded-xl border shadow-sm relative group/field",
                                            field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                        )}>
                                            <div className="space-y-3">
                                                <Label className="text-xs font-bold leading-relaxed">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500 ml-1 font-black">*</span>}
                                                </Label>
                                                
                                                <div className="pt-1">
                                                    {field.type === 'checkbox' && (
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox checked={!!field.value} onCheckedChange={(val) => updateDynamicValue(section.id, field.id, !!val)} />
                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Verified</span>
                                                        </div>
                                                    )}
                                                    {field.type === 'yes-no-na' && (
                                                        <RadioGroup value={field.value || ""} onValueChange={(val) => updateDynamicValue(section.id, field.id, val)} className="flex items-center gap-4">
                                                            <div className="flex items-center space-x-1.5"><RadioGroupItem value="yes" id={`y-edit-${field.id}`} /><Label htmlFor={`y-edit-${field.id}`} className="text-[10px]">Yes</Label></div>
                                                            <div className="flex items-center space-x-1.5"><RadioGroupItem value="no" id={`n-edit-${field.id}`} /><Label htmlFor={`n-edit-${field.id}`} className="text-[10px]">No</Label></div>
                                                            <div className="flex items-center space-x-1.5"><RadioGroupItem value="na" id={`na-edit-${field.id}`} /><Label htmlFor={`na-edit-${field.id}`} className="text-[10px]">N/A</Label></div>
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
                    <Button variant="ghost" className="font-bold text-muted-foreground order-last sm:order-first" onClick={() => onOpenChange(false)} disabled={isPending}>Discard</Button>
                    <div className="hidden sm:block flex-1" />
                    <Button 
                        type="button"
                        variant="outline" 
                        className="w-full sm:w-auto h-12 gap-2" 
                        disabled={isPending} 
                        onClick={form.handleSubmit(v => onSubmit(v, 'draft'), () => scrollToFirstError())}
                    >
                        <Save className="h-4 w-4" /> Save as Draft
                    </Button>
                    <Button 
                        type="button"
                        className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                        disabled={isPending} 
                        onClick={form.handleSubmit(v => onSubmit(v, 'issued'), () => scrollToFirstError())}
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                        Save
                    </Button>
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
