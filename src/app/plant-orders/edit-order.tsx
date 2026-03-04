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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, StopCircle, Plus, Trash2, Calculator } from 'lucide-react';
import type { Project, SubContractor, PlantOrder, PlantOrderItem, PlantRateUnit } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { addWeeks, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const EditPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Order description is required.'),
  notes: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'on-hire', 'off-hired']).default('scheduled'),
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
      status: order.status,
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        supplierId: order.supplierId,
        description: order.description,
        notes: order.notes || '',
        status: order.status,
      });
      setOrderItems(order.items || []);
    }
  }, [open, order, form]);

  const calculateItemCost = (rate: number, unit: PlantRateUnit, start: string, end: string) => {
    if (unit === 'item') return rate;
    const dStart = new Date(start);
    const dEnd = new Date(end);
    const days = Math.max(1, differenceInDays(dEnd, dStart) + 1);
    switch (unit) {
      case 'daily': return rate * days;
      case 'weekly': return (rate / 7) * days;
      case 'monthly': return (rate / 30) * days;
      default: return 0;
    }
  };

  const setQuickOffHire = (weeks: number) => {
    const baseDate = pendingOnHireDate ? new Date(pendingOnHireDate) : new Date();
    const newDate = addWeeks(baseDate, weeks);
    setPendingOffHireDate(newDate.toISOString().split('T')[0]);
  };

  const handleAddItem = () => {
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (!pendingDescription || isNaN(rate)) return;

    const estimatedCost = calculateItemCost(rate, pendingRateUnit, pendingOnHireDate, pendingOffHireDate);

    setOrderItems([...orderItems, {
      id: `item-${Date.now()}`,
      description: pendingDescription,
      onHireDate: pendingOnHireDate,
      anticipatedOffHireDate: pendingOffHireDate,
      actualOffHireDate: null,
      rate: rate,
      rateUnit: pendingRateUnit,
      status: 'scheduled',
      estimatedCost
    }]);

    setPendingDescription('');
    setPendingRate(0);
  };

  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));

  const toggleOffHire = (itemId: string) => {
    setOrderItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const isOffHired = item.status === 'off-hired';
            return {
                ...item,
                status: isOffHired ? 'scheduled' : 'off-hired',
                actualOffHireDate: isOffHired ? null : new Date().toISOString().split('T')[0]
            };
        }
        return item;
    }));
  };

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  }, [orderItems]);

  const onSubmit = (values: EditPlantOrderFormValues) => {
    if (orderItems.length === 0) return;
    startTransition(async () => {
      try {
        const supplier = plantSuppliers.find(s => s.id === values.supplierId);
        const docRef = doc(db, 'plant-orders', order.id);
        
        let overallStatus = values.status;
        if (values.status !== 'draft') {
            const anyActive = orderItems.some(i => i.status !== 'off-hired');
            const allFinished = orderItems.length > 0 && orderItems.every(i => i.status === 'off-hired');
            
            if (allFinished) overallStatus = 'off-hired';
            else if (anyActive) overallStatus = 'scheduled'; 
            else overallStatus = 'scheduled';
        }

        const updates = {
          ...values,
          supplierName: supplier?.name || order.supplierName,
          items: orderItems,
          totalAmount,
          status: overallStatus
        };

        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });
        toast({ title: 'Success', description: 'Hire order updated.' });
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update order.', variant: 'destructive' });
      }
    });
  };

  const submissionStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plant Hire: {order.reference}</DialogTitle>
          <DialogDescription>Modify hire contract details or toggle item statuses.</DialogDescription>
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
              <div className="flex items-center justify-between">
                <FormLabel className="text-primary font-bold">Line Items</FormLabel>
                <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">
                  <Calculator className="h-4 w-4" />
                  Estimated Cost: £{totalAmount.toFixed(2)}
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Plant Description</Label><Input placeholder="e.g. 1.5T Excavator" value={pendingDescription} onChange={e => setPendingDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label className="text-xs">Rate (£)</Label><Input type="number" step="0.01" value={pendingRate} onChange={e => setPendingRate(e.target.value)} /></div>
                    <div className="space-y-2">
                        <Label className="text-xs">Frequency</Label>
                        <Select value={pendingRateUnit} onValueChange={(v: any) => setPendingRateUnit(v)}>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="item">One-off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-xs">On-Hire Date</Label><Input type="date" value={pendingOnHireDate} onChange={e => setPendingOnHireDate(e.target.value)} /></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Expect Off-Hire</Label>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" onClick={() => setQuickOffHire(1)}>+1w</Button>
                          <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" onClick={() => setQuickOffHire(2)}>+2w</Button>
                        </div>
                      </div>
                      <Input type="date" value={pendingOffHireDate} onChange={e => setPendingOffHireDate(e.target.value)} />
                    </div>
                </div>
                <Button type="button" variant="secondary" className="w-full" onClick={handleAddItem} disabled={!pendingDescription}><Plus className="h-4 w-4 mr-2" /> Add Item to Contract</Button>
              </div>

              <div className="space-y-2">
                <TooltipProvider>
                  {orderItems.map((item, idx) => (
                    <div key={item.id} className={cn(
                        "p-3 rounded border bg-background shadow-sm transition-opacity group",
                        item.status === 'off-hired' && "opacity-60 bg-muted/20"
                    )}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <p className={cn("text-sm font-bold truncate", item.status === 'off-hired' ? "text-muted-foreground line-through" : "text-primary")}>
                                {item.description}
                            </p>
                            {item.status === 'off-hired' && <Badge variant="outline" className="text-[8px] h-4">OFF-HIRED</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {item.onHireDate} &rarr; {item.status === 'off-hired' ? `Off-Hired: ${item.actualOffHireDate}` : `Due: ${item.anticipatedOffHireDate}`} | £{item.rate.toFixed(2)}/{item.rateUnit === 'item' ? 'ea' : item.rateUnit[0]}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        type="button" 
                                        variant={item.status === 'off-hired' ? 'destructive' : 'ghost'} 
                                        size="icon" 
                                        className={cn("h-8 w-8 transition-colors", item.status !== 'off-hired' && "text-muted-foreground hover:text-destructive")}
                                        onClick={() => toggleOffHire(item.id)}
                                    >
                                        <StopCircle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{item.status === 'off-hired' ? 'Resume Hire' : 'Off-Hire Item'}</p>
                                </TooltipContent>
                            </Tooltip>

                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(idx)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </div>
                      <div className="flex justify-end mt-1"><span className="text-xs font-bold">Sub: £{item.estimatedCost.toFixed(2)}</span></div>
                    </div>
                  ))}
                </TooltipProvider>
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Contract Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
            )} />

            <DialogFooter className="pt-4 border-t gap-3">
              <Button 
                type="submit" 
                variant="outline" 
                className="w-full sm:w-auto h-12" 
                disabled={isPending} 
                onClick={() => form.setValue('status', 'draft')}
              >
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Draft
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:flex-1 h-12 font-bold" 
                disabled={isPending} 
                onClick={() => {
                  if (submissionStatus === 'draft') form.setValue('status', 'scheduled');
                }}
              >
                {isPending && submissionStatus !== 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                {submissionStatus === 'draft' ? 'Activate Contract' : 'Update Record'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}