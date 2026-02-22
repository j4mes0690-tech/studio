
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
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
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const AddProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required.'),
});

type AddProjectFormValues = z.infer<typeof AddProjectSchema>;

export function AddProjectForm() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddProjectFormValues>({
    resolver: zodResolver(AddProjectSchema),
    defaultValues: { name: '' },
  });

  const onSubmit = (values: AddProjectFormValues) => {
    startTransition(async () => {
      const data = { ...values, areas: [] };
      const colRef = collection(db, 'projects');
      addDoc(colRef, data)
        .then(() => {
          toast({ title: 'Success', description: 'Project added.' });
          form.reset();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl><Input placeholder="New Project Name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>Add Project</Button>
      </form>
    </Form>
  );
}
