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
import { Trash2, ShoppingCart, Loader2, PlusCircle, Calculator, Plus, Calendar, Pencil, Save } from 'lucide-react';
import type { Project, DistributionUser, PurchaseOrder, PurchaseOrderItem, SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn, getProjectInitials, getNextReference } from '@/lib/utils';
import { addWeeks } from 'date-fns';
import { generatePurchaseOrderPDF } from '@/lib/pdf-utils';

const NewOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Order description is required for identification.'),
  notes: z.string().optional(),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type NewOrderFormValues = z.infer<typeof NewOrderSchema>;

const UNIT_OPTIONS = [
  'item',
  'lengths',
  'lm',
  'm2',
  'm3',
  'nr',
  'ton'
];

export function NewOrderDialog({ projects, suppliers, allOrders, currentUser }: { 
  projects: Project[]; 
  suppliers: SubContractor[]; 
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
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

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(NewOrderSchema),
    defaultValues: { 
      projectId: '', 
      supplierId: '', 
      description: '',
      notes: '', 
      status: 'issued' 
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  
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

  const onSubmit = (values: NewOrderFormValues) => {
    if (orderItems.length === 0) {
      toast({ title: 'Order is empty', description: 'Add at least one material item to the order.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allOrders.map(o => ({ reference: o.orderNumber, projectId: o.projectId }));
        const orderNumber = getNextReference(existingRefs, values.projectId, 'PO', initials);
        const supplier = suppliers.find(s => s.id === values.supplierId);

        const orderData: Omit<PurchaseOrder, 'id'> = {
          orderNumber,
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || 'Unknown',
          description: values.description,
          orderDate: new Date().toISOString(),
          items: orderItems.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })) as PurchaseOrderItem[],
          totalAmount: orderTotal,
          status: values.status,
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          notes: values.notes || '',
        };

        const colRef = collection(db, 'purchase-orders');
        const docRef = await addDoc(colRef, orderData).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: orderData,
          }));
          throw error;
        });

        if (values.status === 'issued') {
          toast({ title: 'Order Committed', description: 'Downloading purchase order PDF...' });
          const pdf = await generatePurchaseOrderPDF({ ...orderData, id: docRef.id } as PurchaseOrder, selectedProject, supplier);
          pdf.save(`PO-${orderNumber}-${orderData.supplierName.replace(/\s+/g, '-')}.pdf`);
        } else {
          toast({ title: 'Success', description: 'Order saved as draft.' });
        }
        
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save purchase order.', variant: 'destructive' });
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
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />New Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Generate a formal material request with detailed line items.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('status')} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
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
                      <FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
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
                  <FormLabel>Order Description</FormLabel>
                  <FormControl><Input placeholder="e.g. Ground Floor Drainage Pipework" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Label className="text-xs">Description / Specification</Label>
                    <Input 
                      placeholder="e.g. 20mm Reinforcement Bars" 
                      className="bg-background"
                      value={pendingDescription} 
                      onChange={e => setPendingDescription(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Required Date</Label>
                    <div className="flex gap-1 mb-1">
                      <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] font-bold text-primary" onClick={() => setPendingDeliveryDate(null)}>ASAP</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] font-bold text-primary" onClick={() => setPendingDeliveryDate(addWeeks(new Date(), 1).toISOString())}>+1w</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] font-bold text-primary" onClick={() => setPendingDeliveryDate(addWeeks(new Date(), 2).toISOString())}>+2w</Button>
                    </div>
                    <Input 
                      type={(pendingDeliveryDate || isDateInputFocused) ? "date" : "text"}
                      className="bg-background"
                      value={(pendingDeliveryDate || isDateInputFocused) ? (pendingDeliveryDate ? new Date(pendingDeliveryDate).toISOString().split('T')[0] : '') : 'ASAP'} 
                      onChange={e => setPendingDeliveryDate(e.target.value && e.target.value !== 'ASAP' ? new Date(e.target.value).toISOString() : null)}
                      onFocus={() => setIsDateInputFocused(true)}
                      onBlur={() => setIsDateInputFocused(false)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQuantity(e.target.value)} onFocus={() => setPendingQuantity('')} className="bg-background" />
                  <Select value={pendingUnit} onValueChange={setPendingUnit}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Unit" /></SelectTrigger>
                    <SelectContent>{UNIT_OPTIONS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Rate £" value={pendingRate} onChange={e => setPendingRate(e.target.value)} onFocus={() => setPendingRate('')} className="bg-background" />
                </div>
                
                <Button type="button" onClick={handleAddItem} disabled={!pendingDescription} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Add Line Item</Button>
              </div>

              <div className="space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col p-3 rounded border bg-background group gap-2 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-primary truncate">{item.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <ShoppingCart className="h-2 w-2" /> {item.quantity} {item.unit} @ £{item.rate.toFixed(2)}
                          </span>
                          <span className={cn("text-[10px] flex items-center gap-1 font-semibold", item.deliveryDate ? "text-destructive" : "text-primary")}>
                            <Calendar className="h-2 w-2" /> Due: {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'ASAP'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
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
                  <FormLabel>Delivery Instructions / Project Notes</FormLabel>
                  <FormControl><Textarea placeholder="e.g. Deliver to site entrance B..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                {isPending && submissionStatus === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save as Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={() => form.setValue('status', 'issued')}>
                {isPending && submissionStatus === 'issued' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />}
                Commit Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
