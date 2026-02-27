
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
import { Trash2, ShoppingCart, Loader2, PlusCircle, Calculator, Plus, Calendar } from 'lucide-react';
import type { Project, DistributionUser, PurchaseOrder, PurchaseOrderItem, SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { addWeeks } from 'date-fns';

const NewOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  notes: z.string().optional(),
});

type NewOrderFormValues = z.infer<typeof NewOrderSchema>;

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
  const [pendingQty, setPendingQuantity] = useState<number>(1);
  const [pendingUnit, setPendingUnit] = useState<string>('');
  const [pendingRate, setPendingRate] = useState<number>(0);
  const [pendingDeliveryDate, setPendingDeliveryDate] = useState<string | null>(null);

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(NewOrderSchema),
    defaultValues: { projectId: '', supplierId: '', notes: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const orderTotal = useMemo(() => orderItems.reduce((sum, item) => sum + item.total, 0), [orderItems]);

  const handleAddItem = () => {
    if (!pendingDescription || pendingQty <= 0) {
      toast({ title: 'Invalid Item', description: 'Description and quantity are required.', variant: 'destructive' });
      return;
    }

    setOrderItems([...orderItems, {
      description: pendingDescription,
      quantity: pendingQty,
      unit: pendingUnit || 'pcs',
      rate: pendingRate,
      deliveryDate: pendingDeliveryDate,
      total: pendingQty * pendingRate
    }]);

    // Reset pending
    setPendingDescription('');
    setPendingQuantity(1);
    setPendingUnit('');
    setPendingRate(0);
    setPendingDeliveryDate(null);
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
        const orderNumber = getNextReference(allOrders as any[], values.projectId, 'PO', initials);
        const supplier = suppliers.find(s => s.id === values.supplierId);

        const orderData = {
          orderNumber,
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || 'Unknown',
          orderDate: new Date().toISOString(),
          deliveryDate: null,
          notes: values.notes || '',
          items: orderItems.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })),
          totalAmount: orderTotal,
          status: 'issued',
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim()
        };

        await addDoc(collection(db, 'purchase-orders'), orderData);
        toast({ title: 'Success', description: 'Purchase order created and logged.' });
        setOpen(false);
        setOrderItems([]);
        form.reset();
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save purchase order.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Generate a formal material request with detailed line items and specific delivery dates.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
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

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-bold text-primary">Order Line Items</FormLabel>
                <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">
                  <Calculator className="h-4 w-4" />
                  Order Total: £{orderTotal.toFixed(2)}
                </div>
              </div>

              {/* Add Item Panel */}
              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Description / Specification</Label>
                    <Input 
                      placeholder="e.g. 20mm Reinforcement Bars" 
                      className="h-9 bg-background"
                      value={pendingDescription} 
                      onChange={e => setPendingDescription(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Required Date</Label>
                      <div className="flex gap-1">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" 
                          onClick={() => setPendingDeliveryDate(null)}
                        >
                          ASAP
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" 
                          onClick={() => setPendingDeliveryDate(addWeeks(new Date(), 1).toISOString())}
                        >
                          +1w
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" 
                          onClick={() => setPendingDeliveryDate(addWeeks(new Date(), 2).toISOString())}
                        >
                          +2w
                        </Button>
                      </div>
                    </div>
                    <Input 
                      type="date" 
                      className="h-9 bg-background"
                      value={pendingDeliveryDate ? new Date(pendingDeliveryDate).toISOString().split('T')[0] : ''} 
                      onChange={e => setPendingDeliveryDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Quantity</Label>
                    <Input 
                      type="number" 
                      min="0.1" 
                      step="0.1" 
                      className="h-9 bg-background"
                      value={pendingQty} 
                      onChange={e => setPendingQuantity(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Unit</Label>
                    <Input 
                      placeholder="pcs, m3, ton..." 
                      className="h-9 bg-background"
                      value={pendingUnit} 
                      onChange={e => setPendingUnit(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Rate (£)</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      className="h-9 bg-background"
                      value={pendingRate} 
                      onChange={e => setPendingRate(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                </div>
                
                <Button type="button" onClick={handleAddItem} disabled={!pendingDescription} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Add Line Item
                </Button>
              </div>

              <ScrollArea className="h-64 border rounded-md bg-muted/5">
                <div className="p-3 space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col p-3 rounded border bg-background group gap-2 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-primary truncate">{item.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <ShoppingCart className="h-2 w-2" /> {item.quantity} {item.unit} @ £{item.rate.toFixed(2)}
                            </span>
                            {item.deliveryDate && (
                              <span className="text-[10px] text-destructive flex items-center gap-1 font-semibold">
                                <Calendar className="h-2 w-2" /> Delivery: {new Date(item.deliveryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-foreground">£{item.total.toFixed(2)}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {orderItems.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground italic flex flex-col items-center gap-2">
                      <ShoppingCart className="h-8 w-8 opacity-20" />
                      <p className="text-xs">Add items to generate order line items.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Instructions / Project Notes</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Deliver to site entrance B, contact site manager 1 hour before arrival..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="pt-4 border-t px-6 pb-6">
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(onSubmit)} className="w-full h-12 text-lg font-bold">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
            Issue Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
