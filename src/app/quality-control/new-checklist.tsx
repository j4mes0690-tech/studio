
'use client';

import { useState, useEffect, useTransition } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { createChecklistAction } from './actions';
import { PlusCircle, X } from 'lucide-react';
import type { Project } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const trades = ['Plumbing', 'Electrical', 'HVAC', 'Drywall', 'Painting', 'Concrete', 'General'];

const NewChecklistSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  items: z.string().min(3, 'Checklist must have at least one item.'),
});

type NewChecklistFormValues = z.infer<typeof NewChecklistSchema>;

type NewChecklistProps = {
  projects: Project[];
};

export function NewChecklist({ projects }: NewChecklistProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<string[]>([]);
  const [currentItem, setCurrentItem] = useState('');

  const form = useForm<NewChecklistFormValues>({
    resolver: zodResolver(NewChecklistSchema),
    defaultValues: {
      projectId: '',
      title: '',
      trade: '',
      items: '',
    },
  });

  useEffect(() => {
    form.setValue('items', JSON.stringify(items));
  }, [items, form]);

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
      form.setError('items', { message: 'Checklist must have at least one item.' });
      return;
    }
    
    startTransition(async () => {
      const formData = new FormData();
      formData.append('projectId', values.projectId);
      formData.append('title', values.title);
      formData.append('trade', values.trade);
      formData.append('items', values.items);

      const result = await createChecklistAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
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
          New Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Quality Checklist</DialogTitle>
          <DialogDescription>
            Define a new checklist for a specific trade to ensure quality standards.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="space-y-4 overflow-y-auto pr-2">
                <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
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
                {isPending ? 'Creating...' : 'Create Checklist'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
