'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createInstructionAction, type FormState } from './actions';
import { PlusCircle } from 'lucide-react';
import type { Client, Project } from '@/lib/types';

const NewInstructionSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().min(10, 'Instructions must be at least 10 characters.'),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

type NewInstructionProps = {
  clients: Client[];
  projects: Project[];
};

export function NewInstruction({ clients, projects }: NewInstructionProps) {
  const [open, setOpen] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<NewInstructionFormValues>({
    resolver: zodResolver(NewInstructionSchema),
    defaultValues: {
      clientId: '',
      projectId: '',
      originalText: '',
    },
  });

  const [formState, formAction] = useFormState<FormState, FormData>(
    createInstructionAction,
    { success: false, message: '' }
  );

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast({
          title: 'Success',
          description: formState.message,
        });
        setOpen(false);
        form.reset();
      } else {
        toast({
          title: 'Error',
          description: formState.message,
          variant: 'destructive',
        });
      }
    }
  }, [formState, toast, form]);


  const selectedClientId = form.watch('clientId');

  useEffect(() => {
    if (selectedClientId) {
      setFilteredProjects(projects.filter((p) => p.clientId === selectedClientId));
      form.setValue('projectId', '');
    } else {
      setFilteredProjects([]);
    }
  }, [selectedClientId, projects, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Instruction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record New Instruction</DialogTitle>
          <DialogDescription>
            Capture client instructions on-site. The AI will summarize and
            extract action items automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            onSubmit={form.handleSubmit(() => formRef.current?.submit())}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedClientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="originalText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instruction Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter client instructions here..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Instruction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
