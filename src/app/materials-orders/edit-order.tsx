'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
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
import { Trash2, ShoppingCart, Loader2, Calculator, Plus, Calendar, Pencil, Save } from 'lucide-react';
import type { Project, DistributionUser, PurchaseOrder, PurchaseOrderItem, SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { addWeeks } from 'date-fns';

const EditOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  notes: z.string().optional(),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type EditOrderFormValues = z.infer<typeof EditOrderSchema>;

const UNIT_OPTIONS = [
  'item',
  'lengths',
  'lm',
  'm2',
  'm3',
  'nr',
  'ton'
];

export function EditOrderDialog({ 
  order,
  projects, 
  suppliers, 
  allOrders, 
  currentUser,
  open,
  onOpenChange
}: { 
  order: PurchaseOrder;
  projects: Project[]; 
  suppliers: SubContractor[]; 
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  // Order Items State
  const [orderItems, setOrderItems] = useState<Omit<PurchaseOrderItem, 'id'>[]>([]);
  
  // Pending Item State
  const [pendingDescription, setPendingDescription] = useState<string>('');
  const [pendingQty, setPendingQuantity] = useState<number | string>(1);
  const [pendingUnit, setPendingUnit] = useState<string>('');
  const [pendingRate, setPendingRate] = useState<number | string>(0);
  const [pendingDeliveryDate, setPendingDeliveryDate] = useState<string | null>(null);
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);

  const form = useForm<EditOrderFormValues>({
    resolver: zodResolver(EditOrderSchema),
    defaultValues: { 
      projectId: order.projectId, 
      supplierId: order.supplierId, 
      notes: order.notes || '', 
      status: order.status === 'issued' ? 'issued' : 'draft' 
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        supplierId: order.supplierId,
        notes: order.notes || '',
        status: order.status === 'issued' ? 'issued' : 'draft',
      });
      setOrderItems(order.items || []);
    }
  }, [open, order, form]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  }, [orderItems]);

  const handleAddItem = () => {
    const qty = typeof pendingQty === 'string' ? parseFloat(pendingQty) : pendingQty;
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;

    if (!pendingDescription || isNaN(qty) || qty <= 0) {
      toast({ title: 'Invalid Item', description: 'Description and quantity are required.', variant: 'destructive' });
      return;
    }

    const finalRate = isNaN(rate) ? 0 : rate;

    setOrderItems([...orderItems, {
      description: pendingDescription,
      quantity: qty,
      unit: pendingUnit || 'item',
      rate: finalRate,
      deliveryDate: pendingDeliveryDate,
      total: qty * finalRate
    }]);

    // Reset pending
    setPendingDescription('');
    setPendingQuantity(1);
    setPendingUnit('');
    setPendingRate(0);
    setPendingDeliveryDate(null);
  };

  const handleEditItem = (idx: number) => {
    const item = orderItems[idx];
    setPendingDescription(item.description);
    setPendingQuantity(item.quantity);
    setPendingUnit(item.unit);
    setPendingRate(item.rate);
    setPendingDeliveryDate(item.deliveryDate);
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));

  const onSubmit = (values: EditOrderFormValues) => {
    if (orderItems.length === 0) {
      toast({ title: 'Order is empty', description: 'Add at least one material item.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const supplier = suppliers.find(s => s.id === values.supplierId);
        const docRef = doc(db, 'purchase-orders', order.id);

        const updates: any = {
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || order.supplierName,
          notes: values.notes || '',
          items: orderItems.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })),
          totalAmount: orderTotal,
          status: values.status,
        };

        // Update the orderDate if transitioning from draft to issued
        if (values.status === 'issued' && order.status === 'draft') {
          updates.orderDate = new Date().toISOString();
        }

        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        toast({ title: 'Success', description: 'Purchase order updated.' });
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
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Purchase Order: {order.orderNumber}</DialogTitle>
          <DialogDescription>Modify order details or delivery requirements.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Authorised Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base font-bold text-primary">Order Line Items</FormLabel>
                    <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">
                      <Calculator className="h-4 w-4" />
                      Order Total: £{orderTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input 
                          placeholder="e.g. Bulk Cement" 
                          value={pendingDescription} 
                          onChange={e => setPendingDescription(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Required Date</Label>
                        <div className="flex gap-1 mb-1">
                          <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => setPendingDeliveryDate(null)}>ASAP</Button>
                          <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => setPendingDeliveryDate(addWeeks(new Date(), 1).toISOString())}>+1w</Button>
                        </div>
                        <Input 
                          type={(pendingDeliveryDate || isDateInputFocused) ? "date" : "text"}
                          value={(pendingDeliveryDate || isDateInputFocused) ? (pendingDeliveryDate ? new Date(pendingDeliveryDate).toISOString().split('T')[0] : '') : 'ASAP'} 
                          onChange={e => setPendingDeliveryDate(e.target.value && e.target.value !== 'ASAP' ? new Date(e.target.value).toISOString() : null)}
                          onFocus={() => setIsDateInputFocused(true)}
                          onBlur={() => setIsDateInputFocused(false)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQuantity(e.target.value)} onFocus={() => setPendingQuantity('')} />
                      <Select value={pendingUnit} onValueChange={setPendingUnit}>
                        <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                        <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" step="0.01" placeholder="Rate £" value={pendingRate} onChange={e => setPendingRate(e.target.value)} onFocus={() => setPendingRate('')} />
                    </div>
                    
                    <Button type="button" onClick={handleAddItem} disabled={!pendingDescription} className="w-full">
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col p-3 rounded border bg-background group gap-2 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-primary truncate">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)} | Due: {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'ASAP'}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="flex justify-end"><span className="text-sm font-bold">£{item.total.toFixed(2)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10 gap-3">
              <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 font-bold" disabled={isPending} onClick={() => form.setValue('status', 'issued')}>
                {isPending && submissionStatus === 'issued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                Commit Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
