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
import { PlusCircle, Loader2, Save, Calculator, Plus, Trash2, Link as LinkIcon, MinusCircle, PlusCircle as PlusIcon } from 'lucide-react';
import type { Project, DistributionUser, Variation, VariationItem, VariationItemType, ClientInstruction, Instruction } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn, getProjectInitials, getNextReference } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const NewVariationSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  clientInstructionId: z.string().optional(),
  siteInstructionId: z.string().optional(),
  status: z.enum(['draft', 'pending', 'agreed', 'rejected']).default('draft'),
});

type NewVariationFormValues = z.infer<typeof NewVariationSchema>;

export function NewVariationDialog({ 
  projects, 
  allVariations, 
  clientInstructions, 
  siteInstructions, 
  currentUser 
}: { 
  projects: Project[]; 
  allVariations: Variation[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<Omit<VariationItem, 'id'>[]>([]);
  const [pendingDesc, setPendingDesc] = useState('');
  const [pendingType, setPendingType] = useState<VariationItemType>('addition');
  const [pendingQty, setPendingQty] = useState<number | string>(1);
  const [pendingUnit, setPendingUnit] = useState('item');
  const [pendingRate, setPendingRate] = useState<number | string>(0);

  const form = useForm<NewVariationFormValues>({
    resolver: zodResolver(NewVariationSchema),
    defaultValues: { 
      projectId: '', 
      title: '', 
      description: '', 
      clientInstructionId: '', 
      siteInstructionId: '', 
      status: 'draft' 
    },
  });

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

  const onSubmit = (values: NewVariationFormValues) => {
    if (items.length === 0) {
      toast({ title: 'No items', description: 'Add at least one line item to the variation.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      try {
        const project = projects.find(p => p.id === values.projectId);
        const initials = getProjectInitials(project?.name || 'PRJ');
        const existingRefs = allVariations.map(v => ({ reference: v.reference, projectId: v.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'VO', initials);

        const variationData: Omit<Variation, 'id'> = {
          reference,
          projectId: values.projectId,
          title: values.title,
          description: values.description || '',
          clientInstructionId: values.clientInstructionId || null,
          siteInstructionId: values.siteInstructionId || null,
          items: items.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })),
          totalAmount,
          status: values.status,
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim()
        };

        await addDoc(collection(db, 'variations'), variationData);
        toast({ title: 'Success', description: 'Variation recorded.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save variation.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setItems([]);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />New Variation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Variation Order</DialogTitle>
          <DialogDescription>Record additions and omissions. Link to project directives for audit tracking.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Variation Title</FormLabel><FormControl><Input placeholder="e.g. Additional Groundworks" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="clientInstructionId" render={({ field }) => (
                <FormItem><FormLabel>Link Client Instruction (CI)</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="No Link" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No Link</SelectItem>{filteredCIs.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.reference}: {ci.summary}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="siteInstructionId" render={({ field }) => (
                <FormItem><FormLabel>Link Subcontract Instruction (SI)</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}><FormControl><SelectTrigger><SelectValue placeholder="No Link" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No Link</SelectItem>{filteredSIs.map(si => <SelectItem key={si.id} value={si.id}>{si.reference}: {si.summary}</SelectItem>)}</SelectContent></Select></FormItem>
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
                <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    <RadioGroup value={pendingType} onValueChange={(v: any) => setPendingType(v)} className="flex gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="addition" id="add" /><Label htmlFor="addition" className="flex items-center gap-1.5 text-xs text-green-600 font-bold"><PlusIcon className="h-3 w-3" /> Addition</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="omission" id="om" /><Label htmlFor="omission" className="flex items-center gap-1.5 text-xs text-red-600 font-bold"><MinusCircle className="h-3 w-3" /> Omission</Label></div>
                    </RadioGroup>
                </div>
                <Input placeholder="Description of item..." value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} className="bg-background" />
                <div className="grid grid-cols-3 gap-4">
                  <Input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(e.target.value)} className="bg-background" />
                  <Input placeholder="Unit" value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="bg-background" />
                  <Input type="number" step="0.01" placeholder="Rate £" value={pendingRate} onChange={e => setPendingRate(e.target.value)} className="bg-background" />
                </div>
                <Button type="button" onClick={handleAddItem} disabled={!pendingDesc} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Add Line Item</Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded border bg-background group shadow-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.type === 'addition' ? <PlusIcon className="h-3 w-3 text-green-600" /> : <MinusCircle className="h-3 w-3 text-red-600" />}
                        <p className="text-sm font-bold truncate">{item.description}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-5">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={cn("text-sm font-bold", item.type === 'addition' ? "text-green-600" : "text-red-600")}>
                            {item.type === 'omission' ? '-' : ''}£{item.total.toFixed(2)}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                <Save className="mr-2 h-4 w-4" /> Save as Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending} onClick={() => form.setValue('status', 'pending')}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Submit Variation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
