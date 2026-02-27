
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';

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
          <FormField
            control={form.control}
            name="trades"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <FormLabel>Assigned Trades</FormLabel>
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
                          !field.value?.length && "text-muted-foreground"
                        )}
                      >
                        {field.value?.length > 0
                          ? `${field.value.length} trades selected`
                          : "Select trades..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <ScrollArea className="h-64">
                      <div className="p-2 space-y-1">
                        {allTrades?.map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center space-x-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
                            onClick={() => {
                              const newValue = field.value?.includes(trade.name)
                                ? field.value.filter((v: string) => v !== trade.name)
                                : [...(field.value || []), trade.name];
                              field.onChange(newValue);
                            }}
                          >
                            <Checkbox
                              checked={field.value?.includes(trade.name)}
                              onCheckedChange={() => {}} 
                            />
                            <span className="text-sm">{trade.name}</span>
                          </div>
                        ))}
                        {(allTrades?.length || 0) === 0 && (
                          <p className="p-4 text-xs text-center text-muted-foreground italic">No trades defined. Add trades above.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>Add External Contact</Button>
      </form>
    </Form>
  );
}
