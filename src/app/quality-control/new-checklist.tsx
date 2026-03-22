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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, X, Loader2, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Trade } from '@/lib/types';
import { ManageTradesDialog } from '@/app/settings/manage-trades-dialog';

const NewChecklistSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade identification is required.'),
});

type NewChecklistFormValues = z.infer<typeof NewChecklistSchema>;

export function NewChecklist() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');

  // Fetch defined trades from Firestore
  const tradesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'trades');
  }, [db]);
  const { data: trades, isLoading: tradesLoading } = useCollection<Trade>(tradesQuery);

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Create New Quality Checklist</DialogTitle>
          <DialogDescription>
            Define a new checklist template for specific trade works.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
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
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Trade / Discipline</FormLabel>
                        <ManageTradesDialog showLabel={true} />
                      </div>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={tradesLoading ? "Loading trades..." : "Select trade discipline"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {trades?.map((trade) => (
                            <SelectItem key={trade.id} value={trade.name}>
                              {trade.name}
                            </SelectItem>
                          ))}
                          {(!trades || trades.length === 0) && !tradesLoading && (
                            <div className="p-2 text-xs text-muted-foreground italic text-center">
                              No trades defined. Add them in Settings.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
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
                        <Button type="button" variant="secondary" size="icon" onClick={handleAddItem} className="h-10 w-10 shrink-0">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <ScrollArea className="h-48 rounded-md border mt-2 bg-muted/5">
                        <div className="p-4 space-y-2">
                            {items.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded-md bg-background border">
                                    <span className="text-sm">{item}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                        <X className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-8 italic">No items added yet.</p>}
                        </div>
                    </ScrollArea>
                </FormItem>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Checklist Template
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
