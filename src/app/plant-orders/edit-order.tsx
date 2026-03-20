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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, StopCircle, Plus, Trash2, Calculator, Pencil, PoundSterling, ShoppingCart, FileText } from 'lucide-react';
import type { Project, SubContractor, PlantOrder, PlantOrderItem, PlantRateUnit } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { addWeeks, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { generatePlantOrderPDF } from '@/lib/pdf-utils';

const EditPlantOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  supplierId: z.string().min(1, 'Supplier is required.'),
  description: z.string().min(3, 'Order description is required.'),
  cvrCode: z.string().optional(),
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

  const [orderItems, setOrderItems] = useState<PlantOrderItem[]>([]);
  const [pendingDescription, setPendingDescription] = useState('');
  const [pendingOnHireDate, setPendingOnHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingOffHireDate, setPendingOffHireDate] = useState(addWeeks(new Date(), 1).toISOString().split('T')[0]);
  const [pendingRate, setPendingRate] = useState<number | string>(0);
  const [pendingRateUnit, setPendingRateUnit] = useState<PlantRateUnit>('weekly');

  const form = useForm<EditPlantOrderFormValues>({
    resolver: zodResolver(EditPlantOrderSchema),
    defaultValues: {
      projectId: '',
      supplierId: '',
      description: '',
      cvrCode: '',
      notes: '',
      status: 'scheduled',
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        supplierId: order.supplierId,
        description: order.description,
        cvrCode: order.cvrCode || '',
        notes: order.notes || '',
        status: order.status,
      });
      setOrderItems(order.items || []);
    }
  }, [open, order, form]);

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

  const setQuickOffHire = (weeks: number) => {
    const baseDate = pendingOnHireDate ? parseISO(pendingOnHireDate) : new Date();
    const newDate = addWeeks(baseDate, weeks);
    setPendingOffHireDate(newDate.toISOString().split('T')[0]);
  };

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

  const toggleOffHire = (itemId: string) => {
    setOrderItems(prev => prev.map(item => {
        if (item.id === itemId) {
            const isClosing = item.status !== 'off-hired';
            const newStatus = isClosing ? 'off-hired' : 'scheduled';
            const newActualDate = isClosing ? new Date().toISOString().split('T')[0] : null;
            
            const endDate = newActualDate || item.anticipatedOffHireDate;
            const newCost = calculateItemCost(item.rate, item.rateUnit, item.onHireDate, endDate);

            return {
                ...item,
                status: newStatus,
                actualOffHireDate: newActualDate,
                estimatedCost: newCost
            };
        }
        return item;
    }));
  };

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  }, [orderItems]);

  const onSubmit = (values: EditPlantOrderFormValues, shouldPrint = false) => {
    let finalItems = [...orderItems];
    const pRate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (pendingDescription && !isNaN(pRate) && pRate > 0) {
        finalItems.push({
            id: `item-${Date.now()}-auto`,
            description: pendingDescription,
            onHireDate: pendingOnHireDate,
            anticipatedOffHireDate: pendingOffHireDate,
            actualOffHireDate: null,
            rate: pRate,
            rateUnit: pendingRateUnit,
            status: 'scheduled',
            estimatedCost: livePendingCost
        });
    }

    if (finalItems.length === 0) {
        toast({ title: 'Order Empty', description: 'Please add at least one item to the contract.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        const supplier = plantSuppliers.find(s => s.id === values.supplierId);
        const project = projects.find(p => p.id === values.projectId);
        const docRef = doc(db, 'plant-orders', order.id);
        
        let overallStatus = values.status;
        if (values.status !== 'draft') {
            const allFinished = finalItems.length > 0 && finalItems.every(i => i.status === 'off-hired');
            if (allFinished) overallStatus = 'off-hired';
            else overallStatus = (order.status === 'draft') ? 'scheduled' : order.status; 
        }

        const updates = {
          projectId: values.projectId,
          supplierId: values.supplierId,
          supplierName: supplier?.name || order.supplierName,
          description: values.description,
          cvrCode: values.cvrCode || '',
          notes: values.notes || '',
          items: finalItems,
          totalAmount: finalItems.reduce((sum, i) => sum + i.estimatedCost, 0),
          status: overallStatus
        };

        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          } satisfies SecurityRuleContext));
          throw error;
        });

        if (shouldPrint) {
          toast({ title: 'Changes Saved', description: 'Downloading updated hire contract PDF...' });
          const pdf = await generatePlantOrderPDF({ ...order, ...updates } as PlantOrder, project, supplier);
          pdf.save(`PLANT-${order.reference}.pdf`);
        } else {
          toast({ title: 'Success', description: 'Hire record updated.' });
        }

        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>Edit Plant Hire: {order.reference}</DialogTitle>
          <DialogDescription>Adjust hire contract details and line item pricing.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-6 p-6 pb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem><FormLabel>Supplier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{plantSuppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Contract Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField
                  control={form.control}
                  name="cvrCode"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormLabel>CVR Code</FormLabel>
                        <Badge variant="outline" className="text-[8px] h-3 px-1 uppercase font-bold text-muted-foreground">Internal Only</Badge>
                      </div>
                      <FormControl><Input placeholder="e.g. 104.02" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-primary font-bold">Hire Items</FormLabel>
                  <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/10 px-3 py-1 rounded-full">
                    <Calculator className="h-4 w-4" />
                    Estimated Cost: £{totalAmount.toFixed(2)}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-xs">Plant Description</Label><Input placeholder="e.g. 1.5T Excavator" value={pendingDescription} onChange={e => setPendingDescription(e.target.value)} className="bg-background" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2"><Label className="text-xs">Rate (£)</Label><div className="relative"><PoundSterling className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" /><Input type="number" step="0.01" className="pl-6 h-9 bg-background" value={pendingRate} onChange={e => setPendingRate(e.target.value)} /></div></div>
                      <div className="space-y-2">
                          <Label className="text-xs">Frequency</Label>
                          <Select value={pendingRateUnit} onValueChange={(v: any) => setPendingRateUnit(v)}>
                              <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
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
                      <div className="space-y-2"><Label className="text-xs">On-Hire Date</Label><Input type="date" value={pendingOnHireDate} onChange={e => setPendingOnHireDate(e.target.value)} className="bg-background" /></div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Expect Off-Hire</Label>
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" onClick={() => setQuickOffHire(1)}>+1w</Button>
                            <Button type="button" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10" onClick={() => setQuickOffHire(2)}>+2w</Button>
                          </div>
                        </div>
                        <Input type="date" value={pendingOffHireDate} onChange={e => setPendingOffHireDate(e.target.value)} className="bg-background" />
                      </div>
                  </div>
                  <div className="flex items-center justify-between bg-background p-2 rounded border border-dashed">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Item Forecast</span>
                      <span className="text-sm font-bold text-primary">£{livePendingCost.toFixed(2)}</span>
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
                            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                              {item.onHireDate} &rarr; {item.status === 'off-hired' ? `Actual Off-Hire: ${item.actualOffHireDate}` : `Expect: ${item.anticipatedOffHireDate}`} | £{item.rate.toFixed(2)}/{item.rateUnit[0]}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
                                      <p>{item.status === 'off-hired' ? 'Resume Hire' : 'Stop Hire Now'}</p>
                                  </TooltipContent>
                              </Tooltip>

                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditItem(idx)}>
                                  <Pencil className="h-4 w-4" />
                              </Button>

                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                        </div>
                        <div className="flex justify-end mt-1"><span className="text-xs font-bold text-foreground">Item Total: £{item.estimatedCost.toFixed(2)}</span></div>
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Contract Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
              )} />

              <div className="pt-6 border-t flex flex-col sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full sm:w-auto h-12" 
                  disabled={isPending} 
                  onClick={form.handleSubmit(v => onSubmit({...v, status: 'draft'}, false))}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save as Draft
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full sm:flex-1 h-12 font-bold" 
                  disabled={isPending} 
                  onClick={form.handleSubmit(v => onSubmit(v, false))}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button 
                  type="button" 
                  className="w-full sm:flex-1 h-12 text-lg font-bold" 
                  disabled={isPending} 
                  onClick={form.handleSubmit(v => onSubmit(v, true))}
                >
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
                  Save and Print
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
