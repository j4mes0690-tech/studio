
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useTransition, useEffect } from 'react';
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
import { Pencil, Loader2, Save, Palette } from 'lucide-react';
import type { SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const EditContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional().nullable(),
  isSubContractor: z.boolean().default(false),
  isDesigner: z.boolean().default(false),
  isSupplier: z.boolean().default(false),
  isPlantSupplier: z.boolean().default(false),
}).refine(data => data.isSubContractor || data.isDesigner || data.isSupplier || data.isPlantSupplier, {
  message: "Select at least one category",
  path: ["isSubContractor"]
});

type EditContactFormValues = z.infer<typeof EditContactSchema>;

type EditSubcontractorFormProps = {
  subContractor: SubContractor;
};

export function EditSubcontractorForm({ subContractor }: EditSubcontractorFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditContactFormValues>({
    resolver: zodResolver(EditContactSchema),
    defaultValues: {
      id: subContractor.id,
      name: subContractor.name,
      email: subContractor.email,
      phone: subContractor.phone || '',
      address: subContractor.address || '',
      color: subContractor.color || '#1e40af',
      isSubContractor: !!subContractor.isSubContractor,
      isDesigner: !!subContractor.isDesigner,
      isSupplier: !!subContractor.isSupplier,
      isPlantSupplier: !!subContractor.isPlantSupplier,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: subContractor.id,
        name: subContractor.name,
        email: subContractor.email,
        phone: subContractor.phone || '',
        address: subContractor.address || '',
        color: subContractor.color || '#1e40af',
        isSubContractor: !!subContractor.isSubContractor,
        isDesigner: !!subContractor.isDesigner,
        isSupplier: !!subContractor.isSupplier,
        isPlantSupplier: !!subContractor.isPlantSupplier,
      });
    }
  }, [open, subContractor, form]);

  const onSubmit = (values: EditContactFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'sub-contractors', values.id);
      const updates = {
        name: values.name,
        email: values.email,
        phone: values.phone || '',
        address: values.address || '',
        color: values.color || null,
        isSubContractor: values.isSubContractor,
        isDesigner: values.isDesigner,
        isSupplier: values.isSupplier,
        isPlantSupplier: values.isPlantSupplier,
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Contact information updated.' });
          setOpen(false);
        })
        .catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit External Contact</DialogTitle>
          <DialogDescription>Update details and classification for this partner.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('id')} />
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <Palette className="h-3.5 w-3.5 text-primary" />
                                <FormLabel>Planner Brand Color</FormLabel>
                            </div>
                            <FormControl>
                                <div className="flex gap-2">
                                    <Input type="color" {...field} value={field.value || '#1e40af'} className="w-12 h-10 p-1 cursor-pointer" />
                                    <Input {...field} value={field.value || '#1e40af'} placeholder="#000000" className="flex-1 font-mono text-xs uppercase" />
                                </div>
                            </FormControl>
                            <FormDescription className="text-[10px]">Used for activity bars in the Gantt chart.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Office Address</FormLabel><FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <Separator />

            <div className="space-y-3">
              <FormLabel>Contact Categories</FormLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'isSubContractor', label: 'Sub-contractor' },
                  { key: 'isDesigner', label: 'Designer' },
                  { key: 'isSupplier', label: 'Material Supplier' },
                  { key: 'isPlantSupplier', label: 'Plant Hire Supplier' },
                ].map((cat) => (
                  <FormField key={cat.key} control={form.control} name={cat.key as any} render={({ field }) => (
                    <FormItem className={cn("flex items-center space-x-3 space-y-0 rounded-md border p-3", cat.key === 'isPlantSupplier' && field.value && "border-primary/20 bg-primary/5")}>
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className={cn("cursor-pointer text-xs", cat.key === 'isPlantSupplier' && field.value && "font-bold text-primary")}>{cat.label}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>
              <FormMessage />
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
