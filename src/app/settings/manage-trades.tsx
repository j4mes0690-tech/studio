
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Trade } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TradeSchema = z.object({
  name: z.string().min(1, 'Trade name is required.'),
});

type TradeFormValues = z.infer<typeof TradeSchema>;

export function ManageTrades() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemo(() => query(collection(db, 'trades'), orderBy('name', 'asc')), [db]);
  const { data: trades, isLoading } = useCollection<Trade>(tradesQuery);

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(TradeSchema),
    defaultValues: { name: '' },
  });

  const onAddTrade = (values: TradeFormValues) => {
    startTransition(async () => {
      const tradeData = { name: values.name.trim() };
      const colRef = collection(db, 'trades');
      
      addDoc(colRef, tradeData)
        .then(() => {
          toast({ title: 'Success', description: 'Trade category added.' });
          form.reset();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: tradeData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const onDeleteTrade = (tradeId: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'trades', tradeId);
      deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Success', description: 'Trade category removed.' });
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Add New Category</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAddTrade)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., HVAC, Carpentry, Landscaping" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Trade
            </Button>
          </form>
        </Form>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Available Categories</h3>
        <div className="rounded-md border bg-muted/5 p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (trades?.length || 0) === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-12 italic">No trade categories defined. Add one to begin.</p>
          ) : (
            <div className="space-y-2">
              {trades?.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 rounded-md border bg-background group">
                  <span className="font-medium text-sm">{trade.name}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Trade Category?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{trade.name}" from the selection list. Existing checklists using this trade will not be modified.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteTrade(trade.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
