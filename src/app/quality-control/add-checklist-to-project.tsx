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
import { PlusCircle } from 'lucide-react';
import type { Project, QualityChecklist, Area, SubContractor } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const AssignChecklistSchema = z.object({
  templateId: z.string().min(1, 'A checklist template is required.'),
  projectId: z.string().min(1, 'A project is required.'),
  areaId: z.string().min(1, 'A project area is required.'),
  recipients: z.array(z.string()).optional(),
});

type AssignChecklistFormValues = z.infer<typeof AssignChecklistSchema>;

type AddChecklistToProjectProps = {
  projects: Project[];
  checklistTemplates: QualityChecklist[];
  subContractors: SubContractor[];
};

export function AddChecklistToProject({ projects, checklistTemplates, subContractors }: AddChecklistToProjectProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [areas, setAreas] = useState<Area[]>([]);

  const form = useForm<AssignChecklistFormValues>({
    resolver: zodResolver(AssignChecklistSchema),
    defaultValues: {
      templateId: '',
      projectId: '',
      areaId: '',
      recipients: [],
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    // Only show contacts assigned to the project who are classified as Sub-contractors (Excludes Designers-only)
    return subContractors.filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    if (selectedProjectId) {
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', '');
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, selectedProject, form]);

  const onSubmit = (values: AssignChecklistFormValues) => {
    startTransition(async () => {
      const template = checklistTemplates.find(t => t.id === values.templateId);
      if (!template) return;

      const recipientEmails = subContractors
        .filter(sub => values.recipients?.includes(sub.id))
        .map(sub => sub.email);

      const newChecklist = {
        projectId: values.projectId,
        areaId: values.areaId,
        title: template.title,
        trade: template.trade,
        items: template.items.map(item => ({ ...item, status: 'pending', comment: '' })),
        recipients: recipientEmails,
        isTemplate: false,
        createdAt: new Date().toISOString(),
      };

      const colRef = collection(db, 'quality-checklists');
      addDoc(colRef, newChecklist)
        .then(() => {
          toast({ title: 'Success', description: 'Checklist assigned to project.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: newChecklist,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Checklist to Project</DialogTitle>
          <DialogDescription>
            Select a checklist template and assign it to a project and area.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Checklist Template</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="areaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Area</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId || areas.length === 0}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select an area" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {areas.length > 0 ? areas.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        )) : <SelectItem value="-" disabled>No areas defined for this project</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />
            
            <FormItem>
              <FormLabel>Assign to Sub-Contractor (Optional)</FormLabel>
              <ScrollArea className="h-40 rounded-md border p-4">
                {projectSubs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {selectedProjectId ? "No sub-contractors assigned to this project." : "Please select a project first."}
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
                        <FormLabel className="font-normal">{sub.name}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </ScrollArea>
            </FormItem>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Assigning...' : 'Assign Checklist'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
