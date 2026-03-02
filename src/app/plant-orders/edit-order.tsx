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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, PoundSterling, PowerOff, Play, Plus, Trash2, Calendar } from 'lucide-react';
import type { Project, SubContractor, PlantOrder, PlantOrderItem, PlantRateUnit, PlantStatus } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

const EditPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Order description is required.'),
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

  const plantSuppliers = useMemo(() => subContractors.filter(s => !!s.isPlantSupplier), [subContractors]);

  const [orderItems, setOrderItems] = useState<PlantOrderItem[]>(order.items || []);
  const [pendingDescription, setPendingDescription] = useState('');
  const [pendingOnHireDate, setPendingOnHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingOffHireDate, setPendingOffHireDate] = useState(addWeeks(new Date(), 1).toISOString().split('T')[0]);
  const [pendingRate, setPendingRate] = useState<number | string>(0);
  const [pendingRateUnit, setPendingRateUnit] = useState<PlantRateUnit>('weekly');

  const form = useForm<EditPlantOrderFormValues>({
    resolver: zodResolver(EditPlantOrderSchema),
    defaultValues: {
      projectId: order.projectId,
      supplierId: order.supplierId,
      description: order.description,
      notes: order.notes || '',
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        supplierId: order.supplierId,
        description: order.description,
        notes: order.notes || '',
      });
      setOrderItems(order.items || []);
    }
  }, [open, order, form]);

  const handleAddItem = () => {
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (!pendingDescription || isNaN(rate)) return;

    setOrderItems([...orderItems, {
      id: `item-${Date.now()}`,
      description: pendingDescription,
      onHireDate: pendingOnHireDate,
      anticipatedOffHireDate: pendingOffHireDate,
      actualOffHireDate: null,
      rate: rate,
      rateUnit: pendingRateUnit,
      status: 'scheduled'
    }]);

    setPendingDescription('');
    setPendingRate(0);
  };

  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));

  const updateItemStatus = (itemId: string, newStatus: PlantStatus) => {
    setOrderItems(prev => prev.map(item => {
        if (item.id === itemId) {
            return {
                ...item,
                status: newStatus,
                actualOffHireDate: newStatus === 'off-hired' ? new Date().toISOString().split('T')[0] : null
            };
        }
        return item;
    }));
  };

  const onSubmit = (values: EditPlantOrderFormValues) => {
    if (orderItems.length === 0) return;
    startTransition(async () => {
      try {
        const supplier = plantSuppliers.find(s => s.id === values.supplierId);
        const docRef = doc(db, 'plant-orders', order.id);
        
        // Overall status is 'on-hire' if any item is active
        const hasOnHire = orderItems.some(i => i.status === 'on-hire');
        const allOffHired = orderItems.length > 0 && orderItems.every(i => i.status === 'off-hired');
        const overallStatus = hasOnHire ? 'on-hire' : (allOffHired ? 'off-hired' : 'scheduled');

        const updates = {
          ...values,
          supplierName: supplier?.name || order.supplierName,
          items: orderItems,
          status: overallStatus
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plant Order: {order.reference}</DialogTitle>
          <DialogDescription>Modify hire contract details or update specific item statuses.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem><FormLabel>Supplier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{plantSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Contract Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />

            <Separator />

            <div className="space-y-4">
              <FormLabel className="text-primary font-bold">Manage Items</FormLabel>
              
              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Plant Description</Label><Input placeholder="e.g. JCB JS130" value={pendingDescription} onChange={e => setPendingDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label className="text-xs">Rate</Label><Input type="number" value={pendingRate} onChange={e => setPendingRate(e.target.value)} /></div>
                    <div className="space-y-2">
                        <Label className="text-xs">Per</Label>
                        <Select value={pendingRateUnit} onValueChange={(v: any) => setPendingRateUnit(v)}>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="daily">Day</SelectItem><SelectItem value="weekly">Week</SelectItem><SelectItem value="monthly">Month</SelectItem></SelectContent>
                        </Select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-xs">On-Hire Date</Label><Input type="date" value={pendingOnHireDate} onChange={e => setPendingOnHireDate(e.target.value)} /></div>
                    <div className="space-y-2"><Label className="text-xs">Expected Off-Hire</Label><Input type="date" value={pendingOffHireDate} onChange={e => setPendingOffHireDate(e.target.value)} /></div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleAddItem} disabled={!pendingDescription}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
              </div>

              <div className="space-y-3">
                {orderItems.map((item, idx) => (
                  <div key={item.id} className="p-4 rounded border bg-background shadow-sm space-y-3 group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-bold text-primary truncate">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Hire: {item.onHireDate} &rarr; {item.actualOffHireDate || item.anticipatedOffHireDate} | £{item.rate.toFixed(2)}/{item.rateUnit[0]}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            size="sm"
                            variant={item.status === 'on-hire' ? 'default' : 'outline'} 
                            className="flex-1 h-8 text-[10px] uppercase font-bold"
                            onClick={() => updateItemStatus(item.id, 'on-hire')}
                        >
                            <Play className="h-3 w-3 mr-1" /> Set On-Hire
                        </Button>
                        <Button 
                            type="button" 
                            size="sm"
                            variant={item.status === 'off-hired' ? 'destructive' : 'outline'} 
                            className="flex-1 h-8 text-[10px] uppercase font-bold"
                            onClick={() => updateItemStatus(item.id, 'off-hired')}
                        >
                            <PowerOff className="h-3 w-3 mr-1" /> Set Off-Hire
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>General Contract Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
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
