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
import { PlusCircle, MapPin, Users, Loader2, CheckCircle2, ClipboardCheck } from 'lucide-react';
import type { Project, QualityChecklist, SubContractor } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
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

export function AddChecklistToProject({ 
  projects, 
  checklistTemplates, 
  subContractors, 
  existingChecklists 
}: { 
  projects: Project[], 
  checklistTemplates: QualityChecklist[], 
  subContractors: SubContractor[], 
  existingChecklists: QualityChecklist[] 
}) {
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
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id));
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

            if (selectedTemplate.sections) {
                data.sections = selectedTemplate.sections.map(sec => ({
                    ...sec,
                    items: sec.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] }))
                }));
                data.items = [];
            } else {
                data.items = selectedTemplate.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] }));
            }

            return addDoc(collection(db, 'quality-checklists'), data);
        });
        await Promise.all(promises);
        toast({ title: 'Success', description: `Checklists assigned to ${values.areaIds.length} areas.` });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to assign checklists.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold shadow-lg shadow-primary/20">
                <ClipboardCheck className="h-4 w-4" />
                Assign Checklist
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Assign Trade Checklists to Plots</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <DialogTitle>Assign Trade Checklists</DialogTitle>
          <DialogDescription>Select a master template and assign it to multiple site areas for completion.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 px-6 py-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="projectId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="templateId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Master Template</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {checklistTemplates.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.title} ({t.trade})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormItem>
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Select Plots / Areas</FormLabel>
                        </div>
                        <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                            {availableAreas.length > 0 ? availableAreas.map(area => (
                                <FormField key={area.id} control={form.control} name="areaIds" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                        <FormControl>
                                            <Checkbox 
                                                checked={field.value?.includes(area.id)} 
                                                disabled={alreadyAssignedAreaIds.has(area.id)} 
                                                onCheckedChange={(c) => { 
                                                    const curr = field.value || []; 
                                                    field.onChange(c ? [...curr, area.id] : curr.filter(v => v !== area.id)); 
                                                }} 
                                            />
                                        </FormControl>
                                        <FormLabel className={cn("text-xs font-medium cursor-pointer", alreadyAssignedAreaIds.has(area.id) && "opacity-50")}>
                                            {area.name}
                                            {alreadyAssignedAreaIds.has(area.id) && <span className="ml-2 text-[8px] font-bold text-muted-foreground uppercase">(Already Assigned)</span>}
                                        </FormLabel>
                                    </FormItem>
                                )} />
                            )) : (
                                <p className="text-xs text-muted-foreground italic text-center py-8">Select a project first</p>
                            )}
                        </ScrollArea>
                    </FormItem>
                    <FormItem>
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-accent" />
                            <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Responsible Partners</FormLabel>
                        </div>
                        <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                            {projectSubs.length > 0 ? projectSubs.map(sub => (
                                <FormField key={sub.id} control={form.control} name="recipients" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                        <FormControl>
                                            <Checkbox 
                                                checked={field.value?.includes(sub.id)} 
                                                onCheckedChange={(c) => { 
                                                    const curr = field.value || []; 
                                                    field.onChange(c ? [...curr, sub.id] : curr.filter(v => v !== sub.id)); 
                                                }} 
                                            />
                                        </FormControl>
                                        <FormLabel className="text-xs font-medium cursor-pointer">{sub.name}</FormLabel>
                                    </FormItem>
                                )} />
                            )) : (
                                <p className="text-xs text-muted-foreground italic text-center py-8">Select a project first</p>
                            )}
                        </ScrollArea>
                    </FormItem>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending || !selectedTemplateId || form.watch('areaIds').length === 0} className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
