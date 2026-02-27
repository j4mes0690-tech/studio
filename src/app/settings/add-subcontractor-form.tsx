
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trade } from '@/lib/types';
import { ManageTradesDialog } from './manage-trades-dialog';

const AddContactSchema = z.object({
  name: z.string().min(1, 'Name or company name is required.'),
  email: z.string().email('Invalid email address.'),
  isSubContractor: z.boolean().default(false),
  isDesigner: z.boolean().default(false),
  trades: z.array(z.string()).optional().default([]),
}).refine(data => data.isSubContractor || data.isDesigner, {
  message: "Select at least one category (Sub-contractor or Designer)",
  path: ["isSubContractor"]
});

type AddContactFormValues = z.infer<typeof AddContactSchema>;

export function AddSubcontractorForm({ canManageTrades = false }: { canManageTrades?: boolean }) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemo(() => query(collection(db, 'trades'), orderBy('name', 'asc')), [db]);
  const { data: allTrades } = useCollection<Trade>(tradesQuery);

  const form = useForm<AddContactFormValues>({
    resolver: zodResolver(AddContactSchema),
    defaultValues: { 
      name: '', 
      email: '',
      isSubContractor: true,
      isDesigner: false,
      trades: [],
    },
  });

  const onSubmit = (values: AddContactFormValues) => {
    startTransition(async () => {
      const colRef = collection(db, 'sub-contractors');
      addDoc(colRef, values)
        .then(() => {
          toast({ title: 'Success', description: 'External contact added to system.' });
          form.reset();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: values,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name / Company Name</FormLabel>
              <FormControl><Input placeholder="e.g. Skyline Structures" {...field} /></FormControl>
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
              <FormControl><Input placeholder="contact@company.com" {...field} /></FormControl>
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

        <Button type="submit" className="w-full" disabled={isPending}>Add External Contact</Button>
      </form>
    </Form>
  );
}
