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
import { Trash2, Calculator, Loader2, Save, Plus, PlusCircle as PlusIcon, MinusCircle } from 'lucide-react';
import type { Project, DistributionUser, Variation, VariationItem, VariationItemType, ClientInstruction, Instruction } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const EditVariationSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  clientInstructionId: z.string().optional(),
  siteInstructionId: z.string().optional(),
  status: z.enum(['draft', 'pending', 'agreed', 'rejected']).default('draft'),
});

type EditVariationFormValues = z.infer<typeof EditVariationSchema>;

export function EditVariationDialog({ 
  variation,
  projects, 
  allVariations,
  clientInstructions,
  siteInstructions,
  currentUser,
  open,
  onOpenChange
}: { 
  variation: Variation;
  projects: Project[]; 
  allVariations: Variation[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  currentUser: DistributionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<VariationItem[]>([]);
  const [pendingDesc, setPendingDesc] = useState('');
  const [pendingType, setPendingType] = useState<VariationItemType>('addition');
  const [pendingQty, setPendingQty] = useState<number | string>(1);
  const [pendingUnit, setPendingUnit] = useState('item');
  const [pendingRate, setPendingRate] = useState<number | string>(0);

  const form = useForm<EditVariationFormValues>({
    resolver: zodResolver(EditVariationSchema),
    defaultValues: { 
      projectId: variation.projectId, 
      title: variation.title, 
      description: variation.description || '',
      clientInstructionId: variation.clientInstructionId || 'none',
      siteInstructionId: variation.siteInstructionId || 'none',
      status: variation.status
    },
  });

  useEffect(() => {
    if (open && variation) {
      form.reset({
        projectId: variation.projectId,
        title: variation.title,
        description: variation.description || '',
        clientInstructionId: variation.clientInstructionId || 'none',
        siteInstructionId: variation.siteInstructionId || 'none',
        status: variation.status,
      });
      setItems(variation.items || []);
    }
  }, [open, variation, form]);

  const selectedProjectId = form.watch('projectId');
  const filteredCIs = useMemo(() => clientInstructions.filter(ci => ci.projectId === selectedProjectId), [clientInstructions, selectedProjectId]);
  const filteredSIs = useMemo(() => siteInstructions.filter(si => si.projectId === selectedProjectId), [siteInstructions, selectedProjectId]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      return item.type === 'addition' ? sum + item.total : sum - item.total;
    }, 0);
  }, [items]);

  const handleAddItem = () => {
    const qty = typeof pendingQty === 'string' ? parseFloat(pendingQty) : pendingQty;
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (!pendingDesc || isNaN(qty) || isNaN(rate)) return;

    setItems([...items, {
      id: `item-${Date.now()}`,
      description: pendingDesc,
      type: pendingType,
      quantity: qty,
      unit: pendingUnit,
      rate: rate,
      total: qty * rate
    }]);

    setPendingDesc('');
    setPendingRate(0);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const onSubmit = (values: EditVariationFormValues) => {
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        const docRef = doc(db, 'variations', variation.id);
        const updates = {
          projectId: values.projectId,
          title: values.title,
          description: values.description || '',
          clientInstructionId: values.clientInstructionId === 'none' ? null : values.clientInstructionId,
          siteInstructionId: values.siteInstructionId === 'none' ? null : values.siteInstructionId,
          items,
          totalAmount,
          status: values.status,
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Variation updated.' });
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update variation.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Variation: {variation.reference}</DialogTitle>
          <DialogDescription>Adjust costs or update instruction links.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Variation Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="clientInstructionId" render={({ field }) => (
                <FormItem><FormLabel>Link Client Instruction (CI)</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No Link</SelectItem>{filteredCIs.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.reference}: {ci.summary}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="siteInstructionId" render={({ field }) => (
                <FormItem><FormLabel>Link Subcontract Instruction (SI)</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No Link</SelectItem>{filteredSIs.map(si => <SelectItem key={si.id} value={si.id}>{si.reference}: {si.summary}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-bold text-primary">Line Items</FormLabel>
                <div className={cn(
                    "flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full",
                    totalAmount >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  <Calculator className="h-4 w-4" />
                  Net Total: £{totalAmount.toFixed(2)}
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <RadioGroup value={pendingType} onValueChange={(v: any) => setPendingType(v)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="addition" id="add-edit" /><Label htmlFor="add-edit" className="text-xs text-green-600 font-bold">Addition</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="omission" id="om-edit" /><Label htmlFor="om-edit" className="text-xs text-red-600 font-bold">Omission</Label></div>
                </RadioGroup>
                <Input placeholder="Description..." value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} className="bg-background" />
                <div className="grid grid-cols-3 gap-4">
                  <Input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(e.target.value)} className="bg-background" />
                  <Input placeholder="Unit" value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="bg-background" />
                  <Input type="number" step="0.01" placeholder="Rate £" value={pendingRate} onChange={e => setPendingRate(e.target.value)} className="bg-background" />
                </div>
                <Button type="button" onClick={handleAddItem} disabled={!pendingDesc} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded border bg-background group shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold truncate", item.type === 'addition' ? "text-green-700" : "text-red-700")}>
                        {item.type === 'addition' ? '[+] ' : '[-] '}{item.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={cn("text-sm font-bold", item.type === 'addition' ? "text-green-600" : "text-red-600")}>
                            {item.type === 'omission' ? '-' : ''}£{item.total.toFixed(2)}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Process Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending Submission</SelectItem>
                    <SelectItem value="agreed">Agreed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <DialogFooter className="pt-4 border-t gap-3">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Variation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
