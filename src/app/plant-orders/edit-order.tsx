
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, PoundSterling, PowerOff, Play } from 'lucide-react';
import type { Project, SubContractor, PlantOrder } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const EditPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Equipment description is required.'),
  onHireDate: z.string().min(1, 'On-hire date is required.'),
  anticipatedOffHireDate: z.string().min(1, 'Anticipated off-hire date is required.'),
  actualOffHireDate: z.string().nullable().optional(),
  rate: z.coerce.number().min(0, 'Rate must be positive.'),
  rateUnit: z.enum(['daily', 'weekly', 'monthly']),
  status: z.enum(['scheduled', 'on-hire', 'off-hired']),
  notes: z.string().optional(),
});

type EditPlantOrderFormValues = z.infer<typeof EditPlantOrderSchema>;

export function EditPlantOrderDialog({ 
  order,
  projects, 
  subContractors,
  open,
  onOpenChange
}: { 
  order: PlantOrder;
  projects: Project[]; 
  subContractors: SubContractor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const allSuppliers = useMemo(() => subContractors.filter(s => !!s.isSupplier), [subContractors]);

  const form = useForm<EditPlantOrderFormValues>({
    resolver: zodResolver(EditPlantOrderSchema),
    defaultValues: {
      projectId: order.projectId,
      supplierId: order.supplierId,
      description: order.description,
      onHireDate: new Date(order.onHireDate).toISOString().slice(0, 16),
      anticipatedOffHireDate: new Date(order.anticipatedOffHireDate).toISOString().slice(0, 16),
      actualOffHireDate: order.actualOffHireDate ? new Date(order.actualOffHireDate).toISOString().slice(0, 16) : null,
      rate: order.rate,
      rateUnit: order.rateUnit,
      status: order.status,
      notes: order.notes || '',
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        supplierId: order.supplierId,
        description: order.description,
        onHireDate: new Date(order.onHireDate).toISOString().slice(0, 16),
        anticipatedOffHireDate: new Date(order.anticipatedOffHireDate).toISOString().slice(0, 16),
        actualOffHireDate: order.actualOffHireDate ? new Date(order.actualOffHireDate).toISOString().slice(0, 16) : null,
        rate: order.rate,
        rateUnit: order.rateUnit,
        status: order.status,
        notes: order.notes || '',
      });
    }
  }, [open, order, form]);

  const onSubmit = (values: EditPlantOrderFormValues) => {
    startTransition(async () => {
      try {
        const supplier = allSuppliers.find(s => s.id === values.supplierId);
        const docRef = doc(db, 'plant-orders', order.id);
        const updates = {
          ...values,
          supplierName: supplier?.name || order.supplierName,
          onHireDate: new Date(values.onHireDate).toISOString(),
          anticipatedOffHireDate: new Date(values.anticipatedOffHireDate).toISOString(),
          actualOffHireDate: values.actualOffHireDate ? new Date(values.actualOffHireDate).toISOString() : null,
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Order updated.' });
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update order.', variant: 'destructive' });
      }
    });
  };

  const handleStatusChange = (newStatus: 'on-hire' | 'off-hired') => {
    form.setValue('status', newStatus);
    if (newStatus === 'off-hired') {
        form.setValue('actualOffHireDate', new Date().toISOString().slice(0, 16));
    } else {
        form.setValue('actualOffHireDate', null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Plant Order: {order.reference}</DialogTitle>
          <DialogDescription>Update hire details or record off-hire status.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
            <Button 
                type="button" 
                variant={form.watch('status') === 'on-hire' ? 'default' : 'outline'} 
                className="flex-1 gap-2"
                onClick={() => handleStatusChange('on-hire')}
            >
                <Play className="h-4 w-4" /> On-Hire
            </Button>
            <Button 
                type="button" 
                variant={form.watch('status') === 'off-hired' ? 'destructive' : 'outline'} 
                className="flex-1 gap-2"
                onClick={() => handleStatusChange('off-hired')}
            >
                <PowerOff className="h-4 w-4" /> Off-Hire
            </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem><FormLabel>Supplier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Equipment Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="onHireDate" render={({ field }) => (
                <FormItem><FormLabel>On-Hire Date</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="anticipatedOffHireDate" render={({ field }) => (
                <FormItem><FormLabel>Anticipated Off-Hire</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="actualOffHireDate" render={({ field }) => (
              <FormItem><FormLabel>Actual Off-Hire Date</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value || ''} /></FormControl></FormItem>
            )} />

            <div className="bg-muted/30 p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-end">
                <FormField control={form.control} name="rate" render={({ field }) => (
                    <FormItem className="flex-1"><FormLabel>Hire Rate (£)</FormLabel><FormControl><div className="relative"><PoundSterling className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="number" step="0.01" className="pl-9" {...field} /></div></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="rateUnit" render={({ field }) => (
                    <FormItem className="w-full md:w-40"><FormLabel>Per</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Day</SelectItem><SelectItem value="weekly">Week</SelectItem><SelectItem value="monthly">Month</SelectItem></SelectContent></Select></FormItem>
                )} />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
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
