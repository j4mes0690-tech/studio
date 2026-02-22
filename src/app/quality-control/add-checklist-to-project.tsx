
'use client';

import { useState, useEffect, useTransition } from 'react';
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
import { assignChecklistAction } from './actions';
import { PlusCircle } from 'lucide-react';
import type { Project, QualityChecklist, Area } from '@/lib/types';

const AssignChecklistSchema = z.object({
  templateId: z.string().min(1, 'A checklist template is required.'),
  projectId: z.string().min(1, 'A project is required.'),
  areaId: z.string().min(1, 'A project area is required.'),
});

type AssignChecklistFormValues = z.infer<typeof AssignChecklistSchema>;

type AddChecklistToProjectProps = {
  projects: Project[];
  checklistTemplates: QualityChecklist[];
};

export function AddChecklistToProject({ projects, checklistTemplates }: AddChecklistToProjectProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [areas, setAreas] = useState<Area[]>([]);

  const form = useForm<AssignChecklistFormValues>({
    resolver: zodResolver(AssignChecklistSchema),
    defaultValues: {
      templateId: '',
      projectId: '',
      areaId: '',
    },
  });

  const selectedProjectId = form.watch('projectId');

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', '');
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects, form]);

  const onSubmit = (values: AssignChecklistFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('templateId', values.templateId);
      formData.append('projectId', values.projectId);
      formData.append('areaId', values.areaId);

      const result = await assignChecklistAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
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
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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
                      {checklistTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.title} ({template.trade})</SelectItem>
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
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
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
                        {areas.length > 0 ? areas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                        )) : <SelectItem value="-" disabled>No areas for this project</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
