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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Calculator, Loader2, Save, Plus, PlusCircle as PlusIcon, MinusCircle, Link as LinkIcon, Percent, ChevronDown, Check } from 'lucide-react';
import type { Project, DistributionUser, Variation, VariationItem, VariationItemType, ClientInstruction, Instruction } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn, getProjectInitials, getNextReference } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const NewVariationSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  clientInstructionIds: z.array(z.string()).optional().default([]),
  siteInstructionIds: z.array(z.string()).optional().default([]),
  ohpPercentage: z.coerce.number().min(0, 'OHP must be positive.').default(0),
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
      clientInstructionIds: [], 
      siteInstructionIds: [],
      ohpPercentage: 0,
      status: 'draft' 
    },
  });

  const selectedProjectId = form.watch('projectId');
  const currentOHP = form.watch('ohpPercentage') || 0;
  
  const filteredCIs = useMemo(() => clientInstructions.filter(ci => ci.projectId === selectedProjectId), [clientInstructions, selectedProjectId]);
  const filteredSIs = useMemo(() => siteInstructions.filter(si => si.projectId === selectedProjectId), [siteInstructions, selectedProjectId]);

  const grossCost = useMemo(() => {
    return items.reduce((sum, item) => {
      return item.type === 'addition' ? sum + item.total : sum - item.total;
    }, 0);
  }, [items]);

  const ohpAmount = useMemo(() => (grossCost * (currentOHP / 100)), [grossCost, currentOHP]);
  const netVariationTotal = useMemo(() => grossCost + ohpAmount, [grossCost, ohpAmount]);

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
          clientInstructionIds: values.clientInstructionIds || [],
          siteInstructionIds: values.siteInstructionIds || [],
          items: items.map((item, i) => ({ ...item, id: `item-${Date.now()}-${i}` })),
          ohpPercentage: values.ohpPercentage,
          totalAmount: netVariationTotal,
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
        <Button className="gap-2"><PlusIcon className="h-4 w-4" />New Variation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="clientInstructionIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2 mb-1">
                      <LinkIcon className="h-3.5 w-3.5 text-primary" /> 
                      Link Client Instructions
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn(
                              "w-full justify-between font-normal h-10 px-3 bg-background",
                              !field.value?.length && "text-muted-foreground"
                            )}
                            disabled={!selectedProjectId}
                          >
                            {field.value?.length > 0 
                              ? `${field.value.length} CI${field.value.length > 1 ? 's' : ''} Linked` 
                              : "Select CI References"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-2 border-b bg-muted/30">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Project Client Directives</p>
                        </div>
                        <ScrollArea className="h-64">
                          {filteredCIs.length === 0 ? (
                            <p className="text-xs text-center py-10 text-muted-foreground italic">No instructions found.</p>
                          ) : (
                            <div className="p-1 space-y-1">
                              {filteredCIs.map((ci) => (
                                <div 
                                  key={ci.id} 
                                  className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    const curr = field.value || [];
                                    const next = curr.includes(ci.id) ? curr.filter(v => v !== ci.id) : [...curr, ci.id];
                                    field.onChange(next);
                                  }}
                                >
                                  <Checkbox 
                                    checked={field.value?.includes(ci.id)} 
                                    onCheckedChange={() => {}} // Controlled by div click
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate">{ci.reference}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">{ci.summary}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteInstructionIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2 mb-1">
                      <LinkIcon className="h-3.5 w-3.5 text-primary" /> 
                      Link Site Instructions
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button 
                            variant="outline" 
                            role="combobox" 
                            className={cn(
                              "w-full justify-between font-normal h-10 px-3 bg-background",
                              !field.value?.length && "text-muted-foreground"
                            )}
                            disabled={!selectedProjectId}
                          >
                            {field.value?.length > 0 
                              ? `${field.value.length} SI${field.value.length > 1 ? 's' : ''} Linked` 
                              : "Select SI References"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-2 border-b bg-muted/30">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2">Project Site Instructions</p>
                        </div>
                        <ScrollArea className="h-64">
                          {filteredSIs.length === 0 ? (
                            <p className="text-xs text-center py-10 text-muted-foreground italic">No instructions found.</p>
                          ) : (
                            <div className="p-1 space-y-1">
                              {filteredSIs.map((si) => (
                                <div 
                                  key={si.id} 
                                  className="flex items-center gap-3 px-3 py-2 rounded-sm hover:bg-muted/50 cursor-pointer transition-colors"
                                  onClick={() => {
                                    const curr = field.value || [];
                                    const next = curr.includes(si.id) ? curr.filter(v => v !== si.id) : [...curr, si.id];
                                    field.onChange(next);
                                  }}
                                >
                                  <Checkbox 
                                    checked={field.value?.includes(si.id)} 
                                    onCheckedChange={() => {}} // Controlled by div click
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate">{si.reference}</span>
                                    <span className="text-[10px] text-muted-foreground truncate">{si.summary}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-bold text-primary">Line Items</FormLabel>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs">
                        Subtotal: £{grossCost.toFixed(2)}
                    </div>
                    <div className={cn(
                        "flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full",
                        netVariationTotal >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                    <Calculator className="h-4 w-4" />
                    Net Total: £{netVariationTotal.toFixed(2)}
                    </div>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Type</Label>
                            <RadioGroup value={pendingType} onValueChange={(v: any) => setPendingType(v)} className="flex gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="addition" id="add" /><Label htmlFor="add" className="flex items-center gap-1.5 text-xs text-green-600 font-bold"><PlusIcon className="h-3 w-3" /> Addition</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="omission" id="om" /><Label htmlFor="om" className="flex items-center gap-1.5 text-xs text-red-600 font-bold"><MinusCircle className="h-3 w-3" /> Omission</Label></div>
                            </RadioGroup>
                        </div>
                        <Input placeholder="Description of item..." value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} className="bg-background" />
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Qty</Label><Input type="number" value={pendingQty} onChange={e => setPendingQty(e.target.value)} className="bg-background h-9" /></div>
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit</Label><Input value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="bg-background h-9" /></div>
                            <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Rate £</Label><Input type="number" step="0.01" value={pendingRate} onChange={e => setPendingRate(e.target.value)} className="bg-background h-9" /></div>
                        </div>
                        <Button type="button" onClick={handleAddItem} disabled={!pendingDesc} className="w-full h-10"><Plus className="h-4 w-4 mr-2" /> Add Line Item</Button>
                    </div>
                </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="ohpPercentage" render={({ field }) => (
                    <FormItem className="bg-primary/5 p-4 rounded-lg border-2 border-primary/10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Percent className="h-4 w-4 text-primary" />
                                <FormLabel className="font-bold">Overhead & Profit (OHP)</FormLabel>
                            </div>
                            <Badge variant="secondary" className="font-mono">£{ohpAmount.toFixed(2)}</Badge>
                        </div>
                        <FormControl><Input type="number" step="0.1" {...field} className="bg-background" /></FormControl>
                        <FormDescription className="text-[10px]">Percentage applied to the gross variation value.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Process Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="draft">Draft (Internal)</SelectItem>
                            <SelectItem value="pending">Submitted</SelectItem>
                            <SelectItem value="agreed">Agreed</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                        </Select>
                    </FormItem>
                )} />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-12" disabled={isPending} onClick={() => form.setValue('status', 'draft')}>
                <Save className="mr-2 h-4 w-4" /> Save as Draft
              </Button>
              <Button type="submit" className="w-full sm:flex-1 h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Record Variation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
