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
import { PlusCircle, MapPin, Users, Loader2 } from 'lucide-react';
import type { Project, QualityChecklist, Area, SubContractor } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const AssignChecklistSchema = z.object({
  templateId: z.string().min(1, 'A checklist template is required.'),
  projectId: z.string().min(1, 'A project is required.'),
  areaIds: z.array(z.string()).min(1, 'Select at least one plot or area.'),
  recipients: z.array(z.string()).optional(),
});

type AssignChecklistFormValues = z.infer<typeof AssignChecklistSchema>;

type AddChecklistToProjectProps = {
  projects: Project[];
  checklistTemplates: QualityChecklist[];
  subContractors: SubContractor[];
  existingChecklists: QualityChecklist[];
};

export function AddChecklistToProject({ projects, checklistTemplates, subContractors, existingChecklists }: AddChecklistToProjectProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AssignChecklistFormValues>({
    resolver: zodResolver(AssignChecklistSchema),
    defaultValues: {
      templateId: '',
      projectId: '',
      areaIds: [],
      recipients: [],
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedTemplateId = form.watch('templateId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const selectedTemplate = useMemo(() => checklistTemplates.find(t => t.id === selectedTemplateId), [checklistTemplates, selectedTemplateId]);
  
  const availableAreas = selectedProject?.areas || [];

  const alreadyAssignedAreaIds = useMemo(() => {
    if (!selectedTemplate || !selectedProjectId || !existingChecklists) return new Set<string>();
    
    return new Set(
        existingChecklists
            .filter(c => c.projectId === selectedProjectId && c.title === selectedTemplate.title)
            .map(c => c.areaId)
            .filter((id): id is string => !!id)
    );
  }, [selectedTemplate, selectedProjectId, existingChecklists]);

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    form.setValue('areaIds', []);
  }, [selectedProjectId, selectedTemplateId, form]);

  const onSubmit = (values: AssignChecklistFormValues) => {
    startTransition(async () => {
      try {
        if (!selectedTemplate) return;

        const recipientEmails = subContractors
          .filter(sub => values.recipients?.includes(sub.id))
          .map(sub => sub.email);

        const creationPromises = values.areaIds.map(areaId => {
            const newChecklist = {
                projectId: values.projectId,
                areaId: areaId,
                title: selectedTemplate.title,
                trade: selectedTemplate.trade,
                items: selectedTemplate.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] })),
                recipients: recipientEmails,
                isTemplate: false,
                createdAt: new Date().toISOString(),
                photos: []
            };

            const colRef = collection(db, 'quality-checklists');
            return addDoc(colRef, newChecklist).catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: colRef.path,
                    operation: 'create',
                    requestResourceData: newChecklist,
                }));
                throw error;
            });
        });

        await Promise.all(creationPromises);
        toast({ title: 'Success', description: `Checklist assigned to ${values.areaIds.length} areas.` });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to assign checklists.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <PlusCircle className="h-5 w-5" />
                <span className="sr-only">Assign Checklists</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Assign Trade Checklists</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Assign Trade Checklists</DialogTitle>
          <DialogDescription>
            Select a trade template and assign it to multiple plots. Duplicates are automatically disabled.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist Template</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select trade template" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {checklistTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title} ({t.trade})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select target project" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <FormItem>
                    <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <FormLabel>Select Plots / Areas</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {availableAreas.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-8 italic">
                                {selectedProjectId ? "No areas defined for this project." : "Please select a project first."}
                            </p>
                        ) : availableAreas.map((area) => {
                            const isAssigned = alreadyAssignedAreaIds.has(area.id);
                            return (
                                <FormField
                                    key={area.id}
                                    control={form.control}
                                    name="areaIds"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(area.id)}
                                                    disabled={isAssigned}
                                                    onCheckedChange={(c) => {
                                                        const curr = field.value || [];
                                                        field.onChange(c ? [...curr, area.id] : curr.filter(v => v !== area.id));
                                                    }}
                                                />
                                            </FormControl>
                                            <div className="flex flex-col">
                                                <FormLabel className={cn("text-xs font-medium cursor-pointer", isAssigned && "text-muted-foreground opacity-50")}>
                                                    {area.name}
                                                </FormLabel>
                                                {isAssigned && <span className="text-[8px] text-primary font-bold uppercase tracking-tighter">Already Assigned</span>}
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            );
                        })}
                    </ScrollArea>
                    <FormField control={form.control} name="areaIds" render={() => <FormMessage />} />
                </FormItem>

                <FormItem>
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-accent" />
                        <FormLabel>Notify Trade Partners</FormLabel>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-4 bg-muted/5">
                        {projectSubs.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-8 italic">
                                {selectedProjectId ? "No sub-contractors assigned to this project." : "Select a project to view partners."}
                            </p>
                        ) : projectSubs.map((sub) => (
                            <FormField
                                key={sub.id}
                                control={form.control}
                                name="recipients"
                                render={({ field }) => (
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
                                        <div className="flex flex-col">
                                            <FormLabel className="text-xs font-medium cursor-pointer">{sub.name}</FormLabel>
                                            <span className="text-[9px] text-muted-foreground">{sub.email}</span>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </ScrollArea>
                </FormItem>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPending ? 'Assigning Checklists...' : `Assign to ${form.watch('areaIds')?.length || 0} Plots`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
