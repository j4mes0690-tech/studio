
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Save, Truck, Calendar, PoundSterling } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, PlantOrder } from '@/lib/types';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { addWeeks } from 'date-fns';

const NewPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Equipment description is required.'),
  onHireDate: z.string().min(1, 'On-hire date is required.'),
  anticipatedOffHireDate: z.string().min(1, 'Anticipated off-hire date is required.'),
  rate: z.coerce.number().min(0, 'Rate must be positive.'),
  rateUnit: z.enum(['daily', 'weekly', 'monthly']),
  notes: z.string().optional(),
});

type NewPlantOrderFormValues = z.infer<typeof NewPlantOrderSchema>;

export function NewPlantOrderDialog({ projects, subContractors, allOrders, currentUser }: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allOrders: PlantOrder[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewPlantOrderFormValues>({
    resolver: zodResolver(NewPlantOrderSchema),
    defaultValues: {
      projectId: '',
      supplierId: '',
      description: '',
      onHireDate: new Date().toISOString().slice(0, 16),
      anticipatedOffHireDate: addWeeks(new Date(), 1).toISOString().slice(0, 16),
      rate: 0,
      rateUnit: 'weekly',
      notes: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  
  const allSuppliers = useMemo(() => subContractors.filter(s => !!s.isSupplier), [subContractors]);

  const onSubmit = (values: NewPlantOrderFormValues) => {
    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allOrders.map(o => ({ reference: o.reference, projectId: o.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'PL', initials);
        const supplier = allSuppliers.find(s => s.id === values.supplierId);

        const orderData: Omit<PlantOrder, 'id'> = {
          reference,
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || 'Unknown',
          description: values.description,
          onHireDate: new Date(values.onHireDate).toISOString(),
          anticipatedOffHireDate: new Date(values.anticipatedOffHireDate).toISOString(),
          actualOffHireDate: null,
          rate: values.rate,
          rateUnit: values.rateUnit,
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          notes: values.notes || '',
        };

        const colRef = collection(db, 'plant-orders');
        await addDoc(colRef, orderData);
        
        toast({ title: 'Success', description: 'Plant order recorded.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save order.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Schedule Plant Hire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Plant Order</DialogTitle>
          <DialogDescription>Schedule construction equipment for delivery to site.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Target Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem><FormLabel>Supplier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl><SelectContent>{allSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Plant / Equipment Description</FormLabel><FormControl><Input placeholder="e.g. 3 Tonne Excavator" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="onHireDate" render={({ field }) => (
                <FormItem><FormLabel>On-Hire Date</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="anticipatedOffHireDate" render={({ field }) => (
                <FormItem><FormLabel>Anticipated Off-Hire</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-end">
                <FormField control={form.control} name="rate" render={({ field }) => (
                    <FormItem className="flex-1"><FormLabel>Hire Rate (£)</FormLabel><FormControl><div className="relative"><PoundSterling className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="number" step="0.01" className="pl-9" {...field} /></div></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="rateUnit" render={({ field }) => (
                    <FormItem className="w-full md:w-40"><FormLabel>Per</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="daily">Day</SelectItem><SelectItem value="weekly">Week</SelectItem><SelectItem value="monthly">Month</SelectItem></SelectContent></Select></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Hire Notes / Requirements</FormLabel><FormControl><Textarea placeholder="e.g. Include quick hitch and bucket set..." {...field} /></FormControl></FormItem>
            )} />

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
