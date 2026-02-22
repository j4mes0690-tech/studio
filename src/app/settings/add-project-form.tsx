
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
import { addProjectAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const AddProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required.'),
});

type AddProjectFormValues = z.infer<typeof AddProjectSchema>;

export function AddProjectForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddProjectFormValues>({
    resolver: zodResolver(AddProjectSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: AddProjectFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('name', values.name);

      const result = await addProjectAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        form.reset();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="New Project Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add Project'}
        </Button>
      </form>
    </Form>
  );
}
