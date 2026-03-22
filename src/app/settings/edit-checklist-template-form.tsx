'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Pencil, X, Loader2, Save, Plus } from 'lucide-react';
import type { QualityChecklist, Trade } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ManageTradesDialog } from '@/app/settings/manage-trades-dialog';

const EditChecklistTemplateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  items: z.string().min(3, 'Checklist must have at least one item.'),
});

type EditChecklistTemplateFormValues = z.infer<typeof EditChecklistTemplateSchema>;

type EditChecklistTemplateFormProps = {
  checklist: QualityChecklist;
};

export function EditChecklistTemplateForm({ checklist }: EditChecklistTemplateFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<string[]>(checklist.items.map(i => i.text));
  const [currentItem, setCurrentItem] = useState('');

  // Fetch defined trades from Firestore
  const tradesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'trades');
  }, [db]);
  const { data: trades, isLoading: tradesLoading } = useCollection<Trade>(tradesQuery);

  const form = useForm<EditChecklistTemplateFormValues>({
    resolver: zodResolver(EditChecklistTemplateSchema),
    defaultValues: {
      id: checklist.id,
      title: checklist.title,
      trade: checklist.trade,
      items: JSON.stringify(checklist.items.map(i => i.text)),
    },
  });
  
  useEffect(() => {
    if (open) {
      const initialItems = checklist.items.map(i => i.text);
      form.reset({
        id: checklist.id,
        title: checklist.title,
        trade: checklist.trade,
        items: JSON.stringify(initialItems),
      });
      setItems(initialItems);
      setCurrentItem('');
    }
  }, [open, checklist, form]);

  useEffect(() => {
    form.setValue('items', JSON.stringify(items));
    if (items.length > 0) {
        form.clearErrors('items');
    }
  }, [items, form]);

  const handleAddItem = () => {
    if (currentItem.trim()) {
      setItems([...items, currentItem.trim()]);
      setCurrentItem('');
    }
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setItems(items.filter((_, index) => index !== indexToRemove));
  };

  const onSubmit = (values: EditChecklistTemplateFormValues) => {
    if (items.length === 0) {
        form.setError('items', { message: 'Checklist must have at least one item.' });
        return;
    }

    startTransition(async () => {
      const docRef = doc(db, 'quality-checklists', values.id);
      const updates = {
        title: values.title,
        trade: values.trade,
        items: items.map((text, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          text,
          status: 'pending',
        })),
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Template updated.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit Checklist Template</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Checklist Template</DialogTitle>
          <DialogDescription>
            Update the template's title, trade, and compliance items.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <input type="hidden" {...form.register('id')} />
                <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Checklist Title</FormLabel>
                    <FormControl>
                        <Input {...field} />
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
                            <div key={index} className="flex items-center justify-between p-2 rounded-md border bg-background group">
                                <span className="text-sm">{item}</span>
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                    <X className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                        {items.length === 0 && <p className="text-sm text-center text-muted-foreground py-8 italic">No items added yet.</p>}
                    </div>
                </ScrollArea>
                <FormField
                    control={form.control}
                    name="items"
                    render={() => <FormMessage />}
                />
                </FormItem>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Template Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
