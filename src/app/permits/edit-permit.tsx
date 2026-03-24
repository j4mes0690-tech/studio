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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Save, 
  Clock, 
  Camera, 
  Upload, 
  X, 
  RefreshCw, 
  Layout, 
  Calendar as CalendarIcon, 
  Check,
  Signature as SignatureIcon,
  UserPlus,
  Trash2
} from 'lucide-react';
import type { 
  Project, 
  SubContractor, 
  DistributionUser, 
  Permit, 
  Photo, 
  TemplateSection,
  PermitSignature,
  PermitSignatureRole,
} from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { cn, scrollToFirstError } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CameraOverlay } from '@/components/camera-overlay';
import { SignaturePad } from '@/components/signature-pad';
import { useToast } from '@/hooks/use-toast';

const EditPermitSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  customAreaName: z.string().optional(),
  contractorId: z.string().min(1, 'Contractor is required.'),
  status: z.enum(['draft', 'issued', 'closed', 'cancelled']).default('issued'),
  validTo: z.string().min(1, 'Expiry date/time is required.'),
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
  const [signatures, setSignatures] = useState<PermitSignature[]>(permit.signatures || []);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [pendingSignatoryRole, setPendingSignatoryRole] = useState<PermitSignatureRole>('site-manager');
  const [pendingSignatoryName, setPendingSignatoryName] = useState('');
  
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
      validTo: new Date(permit.validTo).toISOString().slice(0, 16),
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
        validTo: new Date(permit.validTo).toISOString().slice(0, 16),
      });
      setDynamicSections(permit.sections || []);
      setSignatures(permit.signatures || []);
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

  const handleAddSignature = (dataUri: string) => {
    if (!pendingSignatoryName.trim()) return;
    const newSig: PermitSignature = {
        id: `sig-${Date.now()}`,
        role: pendingSignatoryRole,
        name: pendingSignatoryName.trim(),
        signatureDataUri: dataUri,
        signedAt: new Date().toISOString()
    };
    setSignatures([...signatures, newSig]);
    setIsSigning(false);
    setPendingSignatoryName('');
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
        if (signatures.length === 0) {
            toast({ title: "Sign-off Required", description: "Formal issuance requires at least one digital signature.", variant: "destructive" });
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
          signatures: signatures,
          validTo: new Date(values.validTo).toISOString(),
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
      <DialogContent 
        className="w-[95vw] sm:max-w-3xl max-h-[95vh] overflow-hidden flex flex-col p-0 shadow-2xl rounded-xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 md:p-6 bg-muted/10 border-b shrink-0">
          <DialogTitle>Edit Permit: {permit.reference}</DialogTitle>
          <DialogDescription>Adjust hazard controls or validity periods.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 md:p-6 space-y-6 md:space-y-8 bg-muted/5 pb-24">
                <div className="bg-background p-4 md:p-6 rounded-xl border shadow-sm space-y-6">
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
                        <FormField control={form.control} name="validTo" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    Permit Expiry
                                </FormLabel>
                                <FormControl><Input type="datetime-local" {...field} className="bg-background h-11" /></FormControl>
                                <FormDescription className="text-[10px]">Authorization automatically expires at this time.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>

                <Accordion type="multiple" defaultValue={dynamicSections.map(s => s.id)} className="space-y-4">
                    {dynamicSections.map((section) => (
                        <AccordionItem key={section.id} value={section.id} className="border bg-background rounded-xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-4 md:px-6 bg-muted/5 group">
                                <div className="flex items-center gap-2 py-3">
                                    <Layout className="h-4 w-4 text-primary" />
                                    <span className="font-bold text-xs uppercase tracking-widest text-primary">{section.title}</span>
                                </div>
                                <AccordionTrigger className="w-10 h-10 p-0 hover:no-underline border-none shadow-none" />
                            </div>
                            <AccordionContent className="px-4 md:px-6 py-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className={cn(
                                            "bg-background p-4 rounded-xl border shadow-sm relative group/field",
                                            field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1'
                                        )}>
                                            <div className="space-y-4">
                                                <Label className="text-xs font-bold leading-relaxed block">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500 ml-1 font-black">*</span>}
                                                </Label>
                                                
                                                <div className="pt-1">
                                                    {field.type === 'checkbox' && (
                                                        <div className="flex items-center space-x-3 bg-muted/20 p-3 rounded-lg border border-transparent has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition-all cursor-pointer">
                                                            <Checkbox id={`edit-check-${field.id}`} checked={!!field.value} onCheckedChange={(val) => updateDynamicValue(section.id, field.id, !!val)} className="h-5 w-5" />
                                                            <Label htmlFor={`edit-check-${field.id}`} className="text-[10px] text-muted-foreground uppercase font-black cursor-pointer">Verified Compliance</Label>
                                                        </div>
                                                    )}
                                                    {field.type === 'yes-no-na' && (
                                                        <RadioGroup value={field.value || ""} onValueChange={(val) => updateDynamicValue(section.id, field.id, val)} className="grid grid-cols-3 gap-2">
                                                            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-transparent has-[[data-state=checked]]:border-green-500 has-[[data-state=checked]]:bg-green-50 transition-all cursor-pointer">
                                                                <RadioGroupItem value="yes" id={`edit-y-${field.id}`} className="h-5 w-5" />
                                                                <Label htmlFor={`edit-y-${field.id}`} className="text-[10px] font-black uppercase text-green-700 cursor-pointer">Yes</Label>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-transparent has-[[data-state=checked]]:border-red-500 has-[[data-state=checked]]:bg-red-50 transition-all cursor-pointer">
                                                                <RadioGroupItem value="no" id={`edit-n-${field.id}`} className="h-5 w-5" />
                                                                <Label htmlFor={`edit-n-${field.id}`} className="text-[10px] font-black uppercase text-red-700 cursor-pointer">No</Label>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-transparent has-[[data-state=checked]]:border-slate-400 has-[[data-state=checked]]:bg-slate-50 transition-all cursor-pointer">
                                                                <RadioGroupItem value="na" id={`edit-na-${field.id}`} className="h-5 w-5" />
                                                                <Label htmlFor={`edit-na-${field.id}`} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer">N/A</Label>
                                                            </div>
                                                        </RadioGroup>
                                                    )}
                                                    {field.type === 'text' && (
                                                        <Input className="h-11 text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                    )}
                                                    {field.type === 'textarea' && (
                                                        <Textarea className="min-h-[80px] text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                    )}
                                                    {field.type === 'date' && (
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                                            <Input type="date" className="h-11 text-xs" value={field.value || ""} onChange={(e) => updateDynamicValue(section.id, field.id, e.target.value)} />
                                                        </div>
                                                    )}
                                                    {field.type === 'photo' && (
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="flex-1 h-10 gap-2 font-bold" 
                                                                    onClick={() => { setActivePhotoFieldId({ sectionId: section.id, fieldId: field.id }); setIsCameraOpen(true); }}
                                                                >
                                                                    <Camera className="h-4 w-4" /> Camera
                                                                </Button>
                                                                <Button 
                                                                    type="button" 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="flex-1 h-10 gap-2 font-bold" 
                                                                    onClick={() => { setActivePhotoFieldId({ sectionId: section.id, fieldId: field.id }); fieldFileInputRef.current?.click(); }}
                                                                >
                                                                    <Upload className="h-4 w-4" /> Upload
                                                                </Button>
                                                            </div>
                                                            
                                                            {field.value && Array.isArray(field.value) && field.value.length > 0 && (
                                                              <div className="flex flex-wrap gap-2 pt-1">
                                                                {field.value.map((p: Photo, pIdx: number) => (
                                                                  <div key={pIdx} className="relative w-16 h-12 rounded border bg-muted overflow-hidden group/thumb">
                                                                    <Image src={p.url} alt="Verification" fill className="object-cover" />
                                                                    <button 
                                                                      type="button" 
                                                                      className="absolute top-0 right-0 bg-destructive text-white p-0.5 shadow-sm" 
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

                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <SignatureIcon className="h-4 w-4" />
                            Digital Sign-off
                        </h3>
                        <Dialog open={isSigning} onOpenChange={setIsSigning}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-8 gap-2 font-bold text-primary border-primary/20">
                                    <UserPlus className="h-3.5 w-3.5" /> Add Signature
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-lg">
                                <DialogHeader>
                                    <DialogTitle>Capture Digital Signature</DialogTitle>
                                    <DialogDescription>Sign on screen to formally authorize or acknowledge this permit.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-6 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Signatory Role</Label>
                                            <Select value={pendingSignatoryRole} onValueChange={(v: any) => setPendingSignatoryRole(v)}>
                                                <SelectTrigger className="h-11 bg-background"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="site-manager">Site Manager (Authoriser)</SelectItem>
                                                    <SelectItem value="sub-contractor-operative">Sub-contractor Operative</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Full Name</Label>
                                            <Input 
                                                placeholder="e.g. John Smith" 
                                                value={pendingSignatoryName} 
                                                onChange={e => setPendingSignatoryName(e.target.value)}
                                                className="h-11 bg-background" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Manual Signature</Label>
                                        <SignaturePad 
                                            onSave={handleAddSignature} 
                                            onCancel={() => setIsSigning(false)} 
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {signatures.map((sig) => (
                            <div key={sig.id} className="bg-background p-4 rounded-xl border shadow-sm relative group/sig flex flex-col gap-3">
                                <button 
                                    type="button" 
                                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-colors"
                                    onClick={() => setSignatures(signatures.filter(s => s.id !== sig.id))}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                                        <SignatureIcon className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold truncate">{sig.name}</p>
                                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">
                                            {sig.role === 'site-manager' ? 'Site Manager' : 'Operative'}
                                        </p>
                                    </div>
                                </div>
                                <div className="relative aspect-[3/1] bg-muted/10 rounded border border-dashed flex items-center justify-center p-2">
                                    <img src={sig.signatureDataUri} alt="Signature" className="max-h-full max-w-full object-contain" />
                                </div>
                                <p className="text-[8px] text-muted-foreground text-center">Signed at: {new Date(sig.signedAt).toLocaleString()}</p>
                            </div>
                        ))}
                        {signatures.length === 0 && (
                            <div className="col-span-full py-8 text-center border-2 border-dashed rounded-xl bg-muted/5">
                                <SignatureIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">No Signatures Collected</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t pb-12">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                            type="button"
                            variant="outline" 
                            className="w-full h-12 gap-2 font-bold" 
                            disabled={isPending} 
                            onClick={form.handleSubmit(v => onSubmit(v, 'draft'), () => scrollToFirstError())}
                        >
                            <Save className="h-4 w-4" /> Save as Draft
                        </Button>
                        <Button 
                            type="button"
                            className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                            disabled={isPending} 
                            onClick={form.handleSubmit(v => onSubmit(v, 'issued'), () => scrollToFirstError())}
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Save
                        </Button>
                    </div>
                    <Button variant="ghost" className="w-full h-12 font-bold text-muted-foreground" onClick={() => onOpenChange(false)} disabled={isPending}>Discard Changes</Button>
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
