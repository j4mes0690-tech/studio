'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { updateSubContractorAction } from './actions';
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
      const formData = new FormData();
      formData.append('id', values.id);
      formData.append('name', values.name);
      formData.append('email', values.email);

      const result = await updateSubContractorAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setOpen(false);
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
