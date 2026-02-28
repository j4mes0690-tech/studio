
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Loader2, Save, ShieldCheck } from 'lucide-react';
import type { PermitTemplate } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const EditPermitTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().min(10, 'Standard description must be at least 10 characters.'),
  hazards: z.string().min(1, 'Identify standard hazards.'),
  precautions: z.string().min(1, 'Identify standard precautions.'),
});

type EditPermitTemplateFormValues = z.infer<typeof EditPermitTemplateSchema>;

type EditPermitTemplateFormProps = {
  template: PermitTemplate;
};

export function EditPermitTemplateForm({ template }: EditPermitTemplateFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditPermitTemplateFormValues>({
    resolver: zodResolver(EditPermitTemplateSchema),
    defaultValues: {
      id: template.id,
      title: template.title,
      type: template.type,
      description: template.description,
      hazards: template.hazards,
      precautions: template.precautions,
    },
  });
  
  useEffect(() => {
    if (open) {
      form.reset({
        id: template.id,
        title: template.title,
        type: template.type,
        description: template.description,
        hazards: template.hazards,
        precautions: template.precautions,
      });
    }
  }, [open, template, form]);

  const onSubmit = (values: EditPermitTemplateFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'permit-templates', values.id);
      const updates = {
        title: values.title,
        type: values.type,
        description: values.description,
        hazards: values.hazards,
        precautions: values.precautions,
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Template updated.' });
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
          <span className="sr-only">Edit Template</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Permit Template</DialogTitle>
          <DialogDescription>
            Modify standard safety controls for this permit type.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <input type="hidden" {...form.register('id')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Template Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Permit Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Hot Work">Hot Work</SelectItem>
                                    <SelectItem value="Confined Space">Confined Space</SelectItem>
                                    <SelectItem value="Excavation">Excavation</SelectItem>
                                    <SelectItem value="Lifting">Lifting Ops</SelectItem>
                                    <SelectItem value="General">General Works</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Work Description</FormLabel>
                      <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="hazards"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-destructive" /><FormLabel>Hazards</FormLabel></div>
                                <FormControl><Textarea className="min-h-[100px] bg-destructive/5" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="precautions"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-primary" /><FormLabel>Controls</FormLabel></div>
                                <FormControl><Textarea className="min-h-[100px] bg-primary/5" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Update Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
