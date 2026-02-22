
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Pencil } from 'lucide-react';
import type { SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const EditSubcontractorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Company Name is required.'),
  email: z.string().email('Invalid email address.'),
});

type EditSubcontractorFormValues = z.infer<typeof EditSubcontractorSchema>;

type EditSubcontractorFormProps = {
  subContractor: SubContractor;
};

export function EditSubcontractorForm({ subContractor }: EditSubcontractorFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditSubcontractorFormValues>({
    resolver: zodResolver(EditSubcontractorSchema),
    defaultValues: {
      id: subContractor.id,
      name: subContractor.name,
      email: subContractor.email,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: subContractor.id,
        name: subContractor.name,
        email: subContractor.email,
      });
    }
  }, [open, subContractor, form]);

  const onSubmit = (values: EditSubcontractorFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'sub-contractors', values.id);
      const updates = {
        name: values.name,
        email: values.email,
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Sub-contractor updated.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit Sub-contractor</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Sub-contractor</DialogTitle>
          <DialogDescription>
            Update the sub-contractor's name and email address.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
