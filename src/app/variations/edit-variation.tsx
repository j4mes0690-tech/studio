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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Calculator, Loader2, Save, Plus, PlusCircle as PlusIcon, MinusCircle, Link as LinkIcon, Percent, ChevronDown, Check, FileText, ArrowUp, ArrowDown, Pencil, X } from 'lucide-react';
import type { Project, DistributionUser, Variation, VariationItem, VariationItemType, ClientInstruction, Instruction } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { generateVariationPDF } from '@/lib/pdf-utils';

const EditVariationSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  clientInstructionIds: z.array(z.string()).optional().default([]),
  siteInstructionIds: z.array(z.string()).optional().default([]),
  ohpPercentage: z.coerce.number().min(0, 'OHP must be positive.').default(0),
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

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
      clientInstructionIds: variation.clientInstructionIds || [],
      siteInstructionIds: variation.siteInstructionIds || [],
      ohpPercentage: variation.ohpPercentage || 0,
      status: variation.status
    },
  });

  useEffect(() => {
    if (open && variation) {
      form.reset({
        projectId: variation.projectId,
        title: variation.title,
        description: variation.description || '',
        clientInstructionIds: variation.clientInstructionIds || [],
        siteInstructionIds: variation.siteInstructionIds || [],
        ohpPercentage: variation.ohpPercentage || 0,
        status: variation.status,
      });
      setItems(variation.items || []);
      setEditingIdx(null);
    }
  }, [open, variation, form]);

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

  const handleSaveItem = () => {
    const qty = typeof pendingQty === 'string' ? parseFloat(pendingQty) : pendingQty;
    const rate = typeof pendingRate === 'string' ? parseFloat(pendingRate) : pendingRate;
    if (!pendingDesc || isNaN(qty) || isNaN(rate)) return;

    const newItem: VariationItem = {
      id: editingIdx !== null ? items[editingIdx].id : `item-${Date.now()}`,
      description: pendingDesc,
      type: pendingType,
      quantity: qty,
      unit: pendingUnit,
      rate: rate,
      total: qty * rate
    };

    if (editingIdx !== null) {
      const updated = [...items];
      updated[editingIdx] = newItem;
      setItems(updated);
      setEditingIdx(null);
    } else {
      setItems([...items, newItem]);
    }

    setPendingDesc('');
    setPendingRate(0);
    setPendingQty(1);
    setPendingUnit('item');
    setPendingType('addition');
  };

  const handleEditItem = (idx: number) => {
    const item = items[idx];
    setPendingDesc(item.description);
    setPendingType(item.type);
    setPendingQty(item.quantity);
    setPendingUnit(item.unit);
    setPendingRate(item.rate);
    setEditingIdx(idx);
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setPendingDesc('');
    setPendingRate(0);
    setPendingQty(1);
    setPendingUnit('item');
    setPendingType('addition');
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    if (editingIdx === idx) handleCancelEdit();
  };

  const moveItem = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(idx, 1);
    updated.splice(newIdx, 0, moved);
    setItems(updated);
    if (editingIdx === idx) setEditingIdx(newIdx);
    else if (editingIdx === newIdx) setEditingIdx(idx);
  };

  const onSubmit = (values: EditVariationFormValues, shouldPrint = false) => {
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        const docRef = doc(db, 'variations', variation.id);
        const updates = {
          projectId: values.projectId,
          title: values.title,
          description: values.description || '',
          clientInstructionIds: values.clientInstructionIds || [],
          siteInstructionIds: values.siteInstructionIds || [],
          items,
          ohpPercentage: values.ohpPercentage,
          totalAmount: netVariationTotal,
          status: values.status,
        };

        await updateDoc(docRef, updates);

        if (shouldPrint) {
          toast({ title: 'Variation Saved', description: 'Generating PDF document...' });
          const project = projects.find(p => p.id === values.projectId);
          const pdf = await generateVariationPDF({ ...variation, ...updates } as Variation, project, clientInstructions, siteInstructions);
          pdf.save(`VO-${variation.reference}.pdf`);
        } else {
          toast({ title: 'Success', description: 'Variation updated.' });
        }

        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update variation.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/10">
          <DialogTitle>Edit Variation: {variation.reference}</DialogTitle>
          <DialogDescription>Adjust costs or update instruction links.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Form {...form}>
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Variation Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
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
                              type="button"
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
                                      onCheckedChange={() => {}} 
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
                              type="button"
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
                                      onCheckedChange={() => {}} 
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
                      <div className="text-xs text-muted-foreground font-medium">Subtotal: £{grossCost.toFixed(2)}</div>
                      <div className={cn(
                          "flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full",
                          netVariationTotal >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      )}>
                      <Calculator className="h-4 w-4" />
                      Net Total: £{netVariationTotal.toFixed(2)}
                      </div>
                  </div>
                </div>

                <div className={cn(
                  "p-4 rounded-lg border space-y-4 transition-colors",
                  editingIdx !== null ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                )}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-4">
                          <RadioGroup value={pendingType} onValueChange={(v: any) => setPendingType(v)} className="flex gap-4">
                              <div className="flex items-center space-x-2"><RadioGroupItem value="addition" id="add-edit" /><Label htmlFor="add-edit" className="text-xs text-green-600 font-bold">Addition</Label></div>
                              <div className="flex items-center space-x-2"><RadioGroupItem value="omission" id="om-edit" /><Label htmlFor="om-edit" className="text-xs text-red-600 font-bold">Omission</Label></div>
                          </RadioGroup>
                          <Input placeholder="Description..." value={pendingDesc} onChange={e => setPendingDesc(e.target.value)} className="bg-background h-10" />
                      </div>
                      <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                              <Input type="number" placeholder="Qty" value={pendingQty} onChange={e => setPendingQty(e.target.value)} className="bg-background h-10" />
                              <Input placeholder="Unit" value={pendingUnit} onChange={e => setPendingUnit(e.target.value)} className="bg-background h-10" />
                              <Input type="number" step="0.01" placeholder="Rate £" value={pendingRate} onChange={e => setPendingRate(e.target.value)} className="bg-background h-10" />
                          </div>
                          <div className="flex gap-2">
                              {editingIdx !== null && (
                                <Button type="button" variant="ghost" onClick={handleCancelEdit} className="h-10">Cancel</Button>
                              )}
                              <Button type="button" onClick={handleSaveItem} disabled={!pendingDesc} className="flex-1 h-10 font-bold">
                                {editingIdx !== null ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                {editingIdx !== null ? 'Update Item' : 'Add Item'}
                              </Button>
                          </div>
                      </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.id} className={cn(
                        "flex items-center justify-between p-3 rounded border bg-background group shadow-sm transition-all",
                        editingIdx === idx && "ring-2 ring-primary border-transparent"
                    )}>
                      <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-0.5">
                              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 h-fit p-0.5 hover:text-primary disabled:opacity-30" onClick={() => moveItem(idx, 'up')} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 h-fit p-0.5 hover:text-primary disabled:opacity-30" onClick={() => moveItem(idx, 'down')} disabled={idx === items.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-bold truncate", item.type === 'addition' ? "text-green-700" : "text-red-700")}>
                              {item.type === 'addition' ? '[+] ' : '[-] '}{item.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <span className={cn("text-sm font-bold", item.type === 'addition' ? "text-green-600" : "text-red-600")}>
                              {item.type === 'omission' ? '-' : ''}£{item.total.toFixed(2)}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
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
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="pending">Submitted</SelectItem>
                              <SelectItem value="agreed">Agreed</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                          </Select>
                      </FormItem>
                  )} />
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 p-6 border-t bg-muted/10 shrink-0">
          <Button 
            type="button" 
            variant="outline" 
            className="w-full sm:w-auto h-12" 
            disabled={isPending} 
            onClick={form.handleSubmit(v => onSubmit({...v, status: 'draft'}, false))}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          <Button 
            type="button" 
            className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" 
            disabled={isPending} 
            onClick={form.handleSubmit(v => onSubmit({...v, status: 'issued'}, true))}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
            Save and Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
