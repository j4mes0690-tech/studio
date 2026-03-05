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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Save, Truck, Calendar, PoundSterling, Plus, Trash2, Calculator, Pencil } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, PlantOrder, PlantOrderItem, PlantRateUnit } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { addWeeks, differenceInDays, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { VoiceInput } from '@/components/voice-input';
import { Badge } from '@/components/ui/badge';

const NewPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Order description is required.'),
  notes: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'on-hire', 'off-hired']).default('scheduled'),
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

  const [orderItems, setOrderItems] = useState<Omit<PlantOrderItem, 'id'>[]>([]);
  const [pendingDescription, setPendingDescription] = useState('');
  const [pendingOnHireDate, setPendingOnHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingOffHireDate, setPendingOffHireDate] = useState(addWeeks(new Date(), 1).toISOString().split('T')[0]);
  const [pendingRate, setPendingRate] = useState<number | string>(0);
  const [pendingRateUnit, setPendingRateUnit] = useState<PlantRateUnit>('weekly');

  const form = useForm<NewPlantOrderFormValues>({
    resolver: zodResolver(NewPlantOrderSchema),
    defaultValues: {
      projectId: '',
      supplierId: '',
      description: '',
      notes: '',
      status: 'scheduled',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const plantSuppliers = useMemo(() => subContractors.filter(s => !!s.isPlantSupplier), [subContractors]);

  const calculateItemCost = (rate: number, unit: PlantRateUnit, start: string, end: string) => {
    if (unit === 'item') return rate;
    const dStart = parseISO(start);
    const dEnd = parseISO(end);
    const days = Math.max(1, differenceInDays(dEnd, dStart) + 1);
    switch (unit) {
      case 'daily': return rate * days;
      case 'weekly': return (rate / 7) * days;
      case 'monthly': return (rate / 30) * days;
      default: return 0;
    }
  };

  const livePendingCost = useMemo(() => {
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (isNaN(rate) || !pendingOnHireDate || !pendingOffHireDate) return 0;
    return calculateItemCost(rate, pendingRateUnit, pendingOnHireDate, pendingOffHireDate);
  }, [pendingRate, pendingRateUnit, pendingOnHireDate, pendingOffHireDate]);

  const handleAddItem = () => {
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (!pendingDescription || isNaN(rate)) return;

    setOrderItems([...orderItems, {
      description: pendingDescription,
      onHireDate: pendingOnHireDate,
      anticipatedOffHireDate: pendingOffHireDate,
      actualOffHireDate: null,
      rate: rate,
      rateUnit: pendingRateUnit,
      status: 'scheduled',
      estimatedCost: livePendingCost
    }]);

    setPendingDescription('');
    setPendingRate(0);
  };

  const handleEditItem = (idx: number) => {
    const item = orderItems[idx];
    setPendingDescription(item.description);
    setPendingOnHireDate(item.onHireDate);
    setPendingOffHireDate(item.anticipatedOffHireDate);
    setPendingRate(item.rate);
    setPendingRateUnit(item.rateUnit);
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));

  const setQuickOffHire = (weeks: number) => {
    const baseDate = pendingOnHireDate ? parseISO(pendingOnHireDate) : new Date();
    const newDate = addWeeks(baseDate, weeks);
    setPendingOffHireDate(newDate.toISOString().split('T')[0]);
  };

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  }, [orderItems]);

  const onSubmit = (values: NewPlantOrderFormValues) => {
    if (orderItems.length === 0) {
      toast({ title: 'No items', description: 'Add at least one piece of plant to the order.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allOrders.map(o => ({ reference: o.reference, projectId: o.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'PL', initials);
        const supplier = plantSuppliers.find(s => s.id === values.supplierId);

        const orderData: Omit<PlantOrder, 'id'> = {
          reference,
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || 'Unknown',
          description: values.description,
          items: orderItems.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })),
          totalAmount,
          status: values.status,
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          notes: values.notes || '',
        };

        await addDoc(collection(db, 'plant-orders'), orderData);
        toast({ title: 'Success', description: values.status === 'draft' ? 'Order saved as draft.' : 'Order recorded.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save order.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setOrderItems([]);
      form.reset();
    }
  }, [open, form]);

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />Schedule Plant Hire</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Plant Order</DialogTitle>
          <DialogDescription>Schedule construction equipment for delivery to site.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('status')} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Target Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem><FormLabel>Plant Supplier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl><SelectContent>{plantSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Hire Contract Title</FormLabel><FormControl><Input placeholder="e.g. Phase 1 Excavation Equipment" {...field} /></FormControl></FormItem>
            )} />

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-bold text-primary">Line Items</FormLabel>
                <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">
                  <Calculator className="h-4 w-4" />
                  Estimated Contract: £{totalAmount.toFixed(2)}
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Equipment / Asset Description</Label>
                  <Input placeholder="e.g. 3 Tonne Excavator" value={pendingDescription} onChange={e => setPendingDescription(e.target.value)} className="bg-background" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">On-Hire Date</Label><Input type="date" value={pendingOnHireDate} onChange={e => setPendingOnHireDate(e.target.value)} className="bg-background" /></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Anticipated Off-Hire</Label>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary" onClick={() => setQuickOffHire(1)}>+1w</Button>
                        <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary" onClick={() => setQuickOffHire(2)}>+2w</Button>
                      </div>
                    </div>
                    <Input type="date" value={pendingOffHireDate} onChange={e => setPendingOffHireDate(e.target.value)} className="bg-background" />
                  </div>
                </div>

                <div className="bg-background/50 p-3 rounded border flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <Label className="text-xs">Rate (£)</Label>
                        <div className="relative"><PoundSterling className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="number" step="0.01" className="pl-9 h-9" value={pendingRate} onChange={e => setPendingRate(e.target.value)} /></div>
                    </div>
                    <div className="w-full md:w-40 space-y-2">
                        <Label className="text-xs">Per</Label>
                        <Select value={pendingRateUnit} onValueChange={(v: any) => setPendingRateUnit(v)}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Day</SelectItem>
                                <SelectItem value="weekly">Week</SelectItem>
                                <SelectItem value="monthly">Month</SelectItem>
                                <SelectItem value="item">One-off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 pb-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Estimated Item Cost</span>
                        <Badge variant="secondary" className="h-7 px-3 text-primary font-bold">£{livePendingCost.toFixed(2)}</Badge>
                    </div>
                </div>
                
                <Button type="button" onClick={handleAddItem} disabled={!pendingDescription} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Add Item to Order</Button>
              </div>

              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded border bg-background group shadow-sm">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-bold text-primary truncate">{item.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {item.onHireDate} &rarr; {item.anticipatedOffHireDate}</span>
                        <span className="font-bold text-primary">£{item.rate.toFixed(2)} / {item.rateUnit[0]}</span>
                        <span className="font-bold text-foreground">Subtotal: £{item.estimatedCost.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Site Delivery Notes</FormLabel><FormControl><Textarea placeholder="e.g. Access via gate B..." {...field} /></FormControl></FormItem>
            )} />

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                <Save className="mr-2 h-4 w-4" /> Save as Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={() => form.setValue('status', 'scheduled')}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-5 w-5" />}
                Issue Hire Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
