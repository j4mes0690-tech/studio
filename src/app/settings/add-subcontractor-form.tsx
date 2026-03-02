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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const AddContactSchema = z.object({
  name: z.string().min(1, 'Name or company name is required.'),
  email: z.string().email('Invalid email address.'),
  isSubContractor: z.boolean().default(false),
  isDesigner: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
  isPlantSupplier: z.boolean().default(false),
}).refine(data => data.isSubContractor || data.isDesigner || data.isSupplier || data.isPlantSupplier, {
  message: "Select at least one category (Sub-contractor, Designer, Supplier, or Plant Supplier)",
  path: ["isSubContractor"]
});

type AddContactFormValues = z.infer<typeof AddContactSchema>;

export function AddSubcontractorForm() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddContactFormValues>({
    resolver: zodResolver(AddContactSchema),
    defaultValues: { 
      name: '', 
      email: '',
      isSubContractor: true,
      isDesigner: false,
      isSupplier: false,
      isPlantSupplier: false,
    },
  });

  const onSubmit = (values: AddContactFormValues) => {
    startTransition(async () => {
      const colRef = collection(db, 'sub-contractors');
      addDoc(colRef, values)
        .then(() => {
          toast({ title: 'Success', description: 'External contact added to system.' });
          form.reset();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: values,
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
              <FormLabel>Name / Company Name</FormLabel>
              <FormControl><Input placeholder="e.g. Skyline Structures" {...field} /></FormControl>
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
              <FormControl><Input placeholder="contact@company.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />
        
        <div className="space-y-3">
          <FormLabel>Contact Categories</FormLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="isSubContractor"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer text-xs">Sub-contractor</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDesigner"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer text-xs">Designer</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isSupplier"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer text-xs">Material Supplier</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPlantSupplier"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 border-primary/20 bg-primary/5 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="cursor-pointer text-xs font-bold text-primary">Plant Hire Supplier</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <FormMessage />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>Add External Contact</Button>
      </form>
    </Form>
  );
}
