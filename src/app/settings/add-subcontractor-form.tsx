
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
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Trade } from '@/lib/types';
import { ManageTradesDialog } from './manage-trades-dialog';

const AddContactSchema = z.object({
  name: z.string().min(1, 'Name or company name is required.'),
  email: z.string().email('Invalid email address.'),
  isSubContractor: z.boolean().default(false),
  isDesigner: z.boolean().default(false),
  trades: z.array(z.string()).default([]),
}).refine(data => data.isSubContractor || data.isDesigner, {
  message: "Select at least one category (Sub-contractor or Designer)",
  path: ["isSubContractor"]
});

type AddContactFormValues = z.infer<typeof AddContactSchema>;

export function AddSubcontractorForm({ canManageTrades }: { canManageTrades?: boolean }) {
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
              <FormControl><Input placeholder="e.g. Skyline Structures or Jane Smith" {...field} /></FormControl>
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
                    <FormLabel>Sub-contractor</FormLabel>
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
                    <FormLabel>Designer</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <FormMessage />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Assigned Trades</FormLabel>
            {canManageTrades && <ManageTradesDialog showLabel />}
          </div>
          <ScrollArea className="h-40 rounded-md border p-4 bg-muted/5">
            {allTrades?.map((trade) => (
              <FormField
                key={trade.id}
                control={form.control}
                name="trades"
                render={({ field }) => {
                  return (
                    <FormItem
                      key={trade.id}
                      className="flex flex-row items-start space-x-3 space-y-0 mb-2"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(trade.name)}
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, trade.name])
                              : field.onChange(
                                  field.value?.filter(
                                    (value) => value !== trade.name
                                  )
                                )
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal text-xs cursor-pointer">
                        {trade.name}
                      </FormLabel>
                    </FormItem>
                  )
                }}
              />
            ))}
            {(allTrades?.length || 0) === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-8 italic">No trades defined. Add trades above.</p>
            )}
          </ScrollArea>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>Add External Contact</Button>
      </form>
    </Form>
  );
}
