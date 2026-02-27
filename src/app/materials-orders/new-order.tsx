
'use client';

import { useState, useMemo, useTransition } from 'react';
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
import { Plus, Trash2, ShoppingCart, Loader2, PlusCircle, Calculator } from 'lucide-react';
import type { Project, Supplier, Material, DistributionUser, PurchaseOrder, PurchaseOrderItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { DatePicker } from '@/components/date-picker';

const NewOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
});

type NewOrderFormValues = z.infer<typeof NewOrderSchema>;

export function NewOrderDialog({ projects, suppliers, materials, allOrders, currentUser }: { 
  projects: Project[]; 
  suppliers: Supplier[]; 
  materials: Material[];
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  // Order Items State
  const [orderItems, setOrderItems] = useState<Omit<PurchaseOrderItem, 'id'>[]>([]);
  const [pendingMaterialId, setPendingMaterialId] = useState<string>('');
  const [pendingQty, setPendingQuantity] = useState<number>(1);

  const form = useForm<NewOrderFormValues>({
    resolver: zodResolver(NewOrderSchema),
    defaultValues: { projectId: '', supplierId: '', notes: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const orderTotal = useMemo(() => orderItems.reduce((sum, item) => sum + item.total, 0), [orderItems]);

  const handleAddItem = () => {
    const material = materials.find(m => m.id === pendingMaterialId);
    if (!material) return;

    const unitPrice = material.defaultPrice || 0;
    setOrderItems([...orderItems, {
      materialId: material.id,
      materialName: material.name,
      quantity: pendingQty,
      unitPrice: unitPrice,
      total: pendingQty * unitPrice
    }]);
    setPendingMaterialId('');
    setPendingQuantity(1);
  };

  const removeItem = (idx: number) => setOrderItems(orderItems.filter((_, i) => i !== idx));

  const onSubmit = (values: NewOrderFormValues) => {
    if (orderItems.length === 0) {
      toast({ title: 'Order is empty', description: 'Add at least one material to the order.', variant: 'destructive' });
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
          deliveryDate: values.deliveryDate || null,
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>Generate a formal material request for a specific supplier.</DialogDescription>
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

            <FormField
              control={form.control}
              name="deliveryDate"
              render={({ field }) => <DatePicker field={field} label="Required Delivery Date" />}
            />

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-bold">Order Items</FormLabel>
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Calculator className="h-4 w-4" />
                  Total: ${orderTotal.toFixed(2)}
                </div>
              </div>

              <div className="flex gap-2 items-end bg-muted/30 p-3 rounded-lg border">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Material</Label>
                  <Select value={pendingMaterialId} onValueChange={setPendingMaterialId}>
                    <SelectTrigger className="bg-background h-9"><SelectValue placeholder="Select material" /></SelectTrigger>
                    <SelectContent>
                      {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-2">
                  <Label className="text-xs">Quantity</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    step="0.1" 
                    className="h-9"
                    value={pendingQty} 
                    onChange={e => setPendingQuantity(parseFloat(e.target.value) || 0)} 
                  />
                </div>
                <Button type="button" size="sm" onClick={handleAddItem} disabled={!pendingMaterialId}>Add</Button>
              </div>

              <ScrollArea className="h-48 border rounded-md">
                <div className="p-3 space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border bg-background group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.materialName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.quantity} units @ ${item.unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-primary">${item.total.toFixed(2)}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {orderItems.length === 0 && <p className="text-center py-10 text-xs text-muted-foreground italic">Add materials to generate order totals.</p>}
                </div>
              </ScrollArea>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Instructions / Notes</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Deliver to site entrance B, before 10 AM..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="pt-4 border-t">
          <Button type="submit" disabled={isPending} onClick={form.handleSubmit(onSubmit)} className="w-full">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
            Confirm & Issue Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
