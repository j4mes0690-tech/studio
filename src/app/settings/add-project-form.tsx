'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  address: z.string().optional(),
  siteManager: z.string().optional(),
  siteManagerPhone: z.string().optional(),
});

type AddProjectFormValues = z.infer<typeof AddProjectSchema>;

export function AddProjectForm() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddProjectFormValues>({
    resolver: zodResolver(AddProjectSchema),
    defaultValues: { 
      name: '', 
      address: '', 
      siteManager: '', 
      siteManagerPhone: '' 
    },
  });

  const onSubmit = (values: AddProjectFormValues) => {
    startTransition(async () => {
      const data = { 
        name: values.name,
        address: values.address || null,
        siteManager: values.siteManager || null,
        siteManagerPhone: values.siteManagerPhone || null,
        areas: [], 
        assignedUsers: [], 
        assignedSubContractors: [] 
      };
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
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Address</FormLabel>
              <FormControl><Textarea placeholder="Project physical location..." className="min-h-[80px]" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="siteManager"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site Manager</FormLabel>
                <FormControl><Input placeholder="Manager Name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="siteManagerPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manager Phone</FormLabel>
                <FormControl><Input placeholder="Contact Number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>Add Project</Button>
      </form>
    </Form>
  );
}
