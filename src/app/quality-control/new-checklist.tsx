
'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, X, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Trade } from '@/lib/types';
import { ManageTradesDialog } from '../settings/manage-trades-dialog';

const NewChecklistSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade identification is required.'),
});

type NewChecklistFormValues = z.infer<typeof NewChecklistSchema>;

export function NewChecklist({ canManageTrades = false }: { canManageTrades?: boolean }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemo(() => query(collection(db, 'trades'), orderBy('name', 'asc')), [db]);
  const { data: allTrades } = useCollection<Trade>(tradesQuery);

  const [items, setItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');

  const form = useForm<NewChecklistFormValues>({
    resolver: zodResolver(NewChecklistSchema),
    defaultValues: {
      title: '',
      trade: '',
    },
  });

  const handleAddItem = () => {
    if (currentItem.trim()) {
      setItems([...items, currentItem.trim()]);
      setCurrentItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const onSubmit = (values: NewChecklistFormValues) => {
    if (items.length === 0) {
      toast({ title: 'Error', description: 'Checklist must have at least one item.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
      const templateData = {
        title: values.title,
        trade: values.trade,
        isTemplate: true,
        createdAt: new Date().toISOString(),
        items: items.map((text, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          text,
          status: 'pending',
        })),
      };

      const colRef = collection(db, 'quality-checklists');
      addDoc(colRef, templateData)
        .then(() => {
          toast({ title: 'Success', description: 'Checklist template created.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: templateData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
      setItems([]);
      setCurrentItem('');
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Checklist Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Quality Checklist</DialogTitle>
          <DialogDescription>
            Define a new checklist template for specific trade works.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="space-y-4 overflow-y-auto pr-2">
                <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Checklist Title</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Pre-drywall inspection" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                
                <FormField
                  control={form.control}
                  name="trade"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel>Trade / Discipline</FormLabel>
                        {canManageTrades && <ManageTradesDialog showLabel />}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value || "Select trade..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <ScrollArea className="h-64">
                            <div className="p-1 space-y-1">
                              {allTrades?.map((trade) => (
                                <div
                                  key={trade.id}
                                  className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm",
                                    field.value === trade.name && "bg-primary text-primary-foreground font-medium"
                                  )}
                                  onClick={() => {
                                    field.onChange(trade.name);
                                  }}
                                >
                                  {trade.name}
                                  {field.value === trade.name && <Check className="ml-auto h-4 w-4" />}
                                </div>
                              ))}
                              {(allTrades?.length || 0) === 0 && (
                                <p className="text-xs text-center py-4 text-muted-foreground">No trades defined.</p>
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                    <FormLabel>Checklist Items</FormLabel>
                    <div className="flex gap-2">
                        <Input
                            value={currentItem}
                            onChange={(e) => setCurrentItem(e.target.value)}
                            placeholder="Add a new checklist item"
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                        />
                        <Button type="button" onClick={handleAddItem}>Add</Button>
                    </div>

                    <ScrollArea className="h-40 rounded-md border mt-2">
                        <div className="p-4 space-y-2">
                            {items.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <span className="text-sm">{item}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                        <X className="h-4 w-4 text-muted-foreground"/>
                                    </Button>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No items added yet.</p>}
                        </div>
                    </ScrollArea>
                </FormItem>
            </div>

            <DialogFooter className="mt-auto pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Checklist
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
