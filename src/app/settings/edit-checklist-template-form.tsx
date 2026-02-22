
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
import { useToast } from '@/hooks/use-toast';
import { Pencil, X } from 'lucide-react';
import type { QualityChecklist } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const trades = ['Plumbing', 'Electrical', 'HVAC', 'Drywall', 'Painting', 'Concrete', 'General'];

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Checklist Template</DialogTitle>
          <DialogDescription>
            Update the template's title, trade, and items.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 flex-1 flex flex-col min-h-0"
          >
            <div className="space-y-4 overflow-y-auto pr-2">
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
                    <FormLabel>Trade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a trade" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {trades.map((trade) => (
                            <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                        ))}
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
                <FormField
                    control={form.control}
                    name="items"
                    render={() => (
                    <FormMessage />
                    )}
                />
                </FormItem>
            </div>

            <DialogFooter className="mt-auto pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
