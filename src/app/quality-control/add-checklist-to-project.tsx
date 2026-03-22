'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, MapPin, Users, Loader2, CheckCircle2 } from 'lucide-react';
import type { Project, QualityChecklist, SubContractor } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

const AssignChecklistSchema = z.object({
  templateId: z.string().min(1, 'A checklist template is required.'),
  projectId: z.string().min(1, 'A project is required.'),
  areaIds: z.array(z.string()).min(1, 'Select at least one plot or area.'),
  recipients: z.array(z.string()).optional(),
});

type AssignChecklistFormValues = z.infer<typeof AssignChecklistSchema>;

export function AddChecklistToProject({ projects, checklistTemplates, subContractors, existingChecklists }: { projects: Project[], checklistTemplates: QualityChecklist[], subContractors: SubContractor[], existingChecklists: QualityChecklist[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AssignChecklistFormValues>({
    resolver: zodResolver(AssignChecklistSchema),
    defaultValues: { templateId: '', projectId: '', areaIds: [], recipients: [] },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedTemplateId = form.watch('templateId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const selectedTemplate = useMemo(() => checklistTemplates.find(t => t.id === selectedTemplateId), [checklistTemplates, selectedTemplateId]);
  
  const availableAreas = selectedProject?.areas || [];

  const alreadyAssignedAreaIds = useMemo(() => {
    if (!selectedTemplate || !selectedProjectId) return new Set<string>();
    return new Set(existingChecklists.filter(c => c.projectId === selectedProjectId && c.title === selectedTemplate.title).map(c => c.areaId).filter((id): id is string => !!id));
  }, [selectedTemplate, selectedProjectId, existingChecklists]);

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => { form.setValue('areaIds', []); }, [selectedProjectId, selectedTemplateId, form]);

  const onSubmit = (values: AssignChecklistFormValues) => {
    startTransition(async () => {
      try {
        if (!selectedTemplate) return;
        const recipientEmails = subContractors.filter(sub => values.recipients?.includes(sub.id)).map(sub => sub.email);
        
        const promises = values.areaIds.map(areaId => {
            const data: any = { 
                projectId: values.projectId, 
                areaId, 
                title: selectedTemplate.title, 
                trade: selectedTemplate.trade, 
                recipients: recipientEmails, 
                isTemplate: false, 
                createdAt: new Date().toISOString(), 
                photos: [] 
            };

            // Handle both legacy and sectional templates
            if (selectedTemplate.sections) {
                data.sections = selectedTemplate.sections.map(sec => ({
                    ...sec,
                    items: sec.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] }))
                }));
                data.items = []; // Placeholder for legacy compat
            } else {
                data.items = selectedTemplate.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] }));
            }

            return addDoc(collection(db, 'quality-checklists'), data);
        });
        await Promise.all(promises);
        toast({ title: 'Success', description: 'Checklists assigned.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><DialogTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9"><PlusCircle className="h-5 w-5" /></Button></DialogTrigger></TooltipTrigger>
          <TooltipContent><p>Assign Trade Checklists</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Trade Checklists</DialogTitle>
          <DialogDescription>Select a template and assign it to multiple plots.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="templateId" render={({ field }) => (
                <FormItem><FormLabel>Template</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger></FormControl><SelectContent>{checklistTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormItem>
                    <div className="flex items-center gap-2 mb-2"><MapPin className="h-4 w-4 text-primary" /><FormLabel>Select Plots</FormLabel></div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {availableAreas.map(area => (
                            <FormField key={area.id} control={form.control} name="areaIds" render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                    <FormControl><Checkbox checked={field.value?.includes(area.id)} disabled={alreadyAssignedAreaIds.has(area.id)} onCheckedChange={(c) => { const curr = field.value || []; field.onChange(c ? [...curr, area.id] : curr.filter(v => v !== area.id)); }} /></FormControl>
                                    <FormLabel className={cn("text-xs font-medium", alreadyAssignedAreaIds.has(area.id) && "opacity-50")}>{area.name}</FormLabel>
                                </FormItem>
                            )} />
                        ))}
                    </ScrollArea>
                </FormItem>
                <FormItem>
                    <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-accent" /><FormLabel>Trade Partners</FormLabel></div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {projectSubs.map(sub => (
                            <FormField key={sub.id} control={form.control} name="recipients" render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                    <FormControl><Checkbox checked={field.value?.includes(sub.id)} onCheckedChange={(c) => { const curr = field.value || []; field.onChange(c ? [...curr, sub.id] : curr.filter(v => v !== sub.id)); }} /></FormControl>
                                    <FormLabel className="text-xs font-medium">{sub.name}</FormLabel>
                                </FormItem>
                            )} />
                        ))}
                    </ScrollArea>
                </FormItem>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Assign Checklists
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
