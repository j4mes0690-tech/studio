
'use client';

import { useState, useTransition } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Save, ShieldCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const NewPermitTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().min(10, 'Standard description must be at least 10 characters.'),
  hazards: z.string().min(1, 'Identify standard hazards.'),
  precautions: z.string().min(1, 'Identify standard precautions.'),
});

type NewPermitTemplateFormValues = z.infer<typeof NewPermitTemplateSchema>;

export function NewPermitTemplate() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewPermitTemplateFormValues>({
    resolver: zodResolver(NewPermitTemplateSchema),
    defaultValues: {
      title: '',
      type: 'General',
      description: '',
      hazards: '',
      precautions: '',
    },
  });

  const onSubmit = (values: NewPermitTemplateFormValues) => {
    startTransition(async () => {
      const templateData = {
        ...values,
        createdAt: new Date().toISOString(),
      };

      const colRef = collection(db, 'permit-templates');
      addDoc(colRef, templateData)
        .then(() => {
          toast({ title: 'Success', description: 'Permit template created.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: templateData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Permit Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Create Permit Template</DialogTitle>
          <DialogDescription>
            Define standard work descriptions and safety controls for high-risk permits.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Template Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Roof-level welding" {...field} />
                            </FormControl>
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
                      <FormControl>
                        <Textarea placeholder="Standard details for this task type..." className="min-h-[100px]" {...field} />
                      </FormControl>
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
                                <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-destructive" /><FormLabel>Key Hazards</FormLabel></div>
                                <FormControl>
                                    <Textarea placeholder="Standard hazards..." className="min-h-[100px] bg-destructive/5" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="precautions"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-primary" /><FormLabel>Safety Controls</FormLabel></div>
                                <FormControl>
                                    <Textarea placeholder="Standard precautions..." className="min-h-[100px] bg-primary/5" {...field} />
                                </FormControl>
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
                Save Permit Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
