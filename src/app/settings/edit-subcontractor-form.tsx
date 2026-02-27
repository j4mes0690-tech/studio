
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect, useMemo } from 'react';
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
import { Pencil, Check, ChevronsUpDown } from 'lucide-react';
import type { SubContractor, Trade } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ManageTradesDialog } from './manage-trades-dialog';

const EditContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  isSubContractor: z.boolean().default(false),
  isDesigner: z.boolean().default(false),
  trades: z.array(z.string()).optional().default([]),
}).refine(data => data.isSubContractor || data.isDesigner, {
  message: "Select at least one category",
  path: ["isSubContractor"]
});

type EditContactFormValues = z.infer<typeof EditContactSchema>;

type EditSubcontractorFormProps = {
  subContractor: SubContractor;
  canManageTrades?: boolean;
};

export function EditSubcontractorForm({ subContractor, canManageTrades = false }: EditSubcontractorFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemo(() => query(collection(db, 'trades'), orderBy('name', 'asc')), [db]);
  const { data: allTrades } = useCollection<Trade>(tradesQuery);

  const form = useForm<EditContactFormValues>({
    resolver: zodResolver(EditContactSchema),
    defaultValues: {
      id: subContractor.id,
      name: subContractor.name,
      email: subContractor.email,
      isSubContractor: !!subContractor.isSubContractor,
      isDesigner: !!subContractor.isDesigner,
      trades: subContractor.trades || [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: subContractor.id,
        name: subContractor.name,
        email: subContractor.email,
        isSubContractor: !!subContractor.isSubContractor,
        isDesigner: !!subContractor.isDesigner,
        trades: subContractor.trades || [],
      });
    }
  }, [open, subContractor, form]);

  const onSubmit = (values: EditContactFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'sub-contractors', values.id);
      const updates = {
        name: values.name,
        email: values.email,
        isSubContractor: values.isSubContractor,
        isDesigner: values.isDesigner,
        trades: values.trades,
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Contact information updated.' });
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
          <span className="sr-only">Edit Contact</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit External Contact</DialogTitle>
          <DialogDescription>
            Update credentials and classification for this partner.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name / Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-3">
              <FormLabel>Contact Category</FormLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isSubContractor"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="cursor-pointer">Sub-contractor</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isDesigner"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="cursor-pointer">Designer</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <FormMessage />
            </div>

            <FormField
              control={form.control}
              name="trades"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Assigned Trade Categories</FormLabel>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "flex-1 justify-between font-normal",
                              !field.value?.length && "text-muted-foreground"
                            )}
                          >
                            {field.value?.length 
                              ? `${field.value.length} trade${field.value.length > 1 ? 's' : ''} selected` 
                              : "Select trades..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <ScrollArea className="h-64">
                          <div className="p-1 space-y-1">
                            {allTrades?.map((trade) => (
                              <div
                                key={trade.id}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm",
                                  field.value?.includes(trade.name) && "bg-primary/5 text-primary font-medium"
                                )}
                                onClick={() => {
                                  const current = field.value || [];
                                  const next = current.includes(trade.name)
                                    ? current.filter(v => v !== trade.name)
                                    : [...current, trade.name];
                                  field.onChange(next);
                                }}
                              >
                                <div className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-sm border border-primary transition-colors",
                                  field.value?.includes(trade.name) ? "bg-primary text-primary-foreground" : "opacity-50"
                                )}>
                                  {field.value?.includes(trade.name) && <Check className="h-3 w-3" />}
                                </div>
                                {trade.name}
                              </div>
                            ))}
                            {(allTrades?.length || 0) === 0 && (
                              <p className="text-xs text-center py-4 text-muted-foreground">No trades defined.</p>
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    {canManageTrades && <ManageTradesDialog />}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {field.value?.map(trade => (
                      <Badge key={trade} variant="secondary" className="text-[10px] h-5">{trade}</Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t">
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
