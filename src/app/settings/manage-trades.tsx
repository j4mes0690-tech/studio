'use client';

import { useState, useTransition } from 'react';
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
import { Trash2, Plus, Loader2, Tag } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const TradeSchema = z.object({
  name: z.string().min(1, 'Trade name is required.'),
});

type TradeFormValues = z.infer<typeof TradeSchema>;

export function ManageTrades() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'trades'), orderBy('name', 'asc'));
  }, [db]);
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
    <div className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg border">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAddTrade)} className="flex gap-2 items-start">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input 
                      placeholder="Enter new trade name (e.g., Plumbing)" 
                      className="bg-background"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="shrink-0">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Trade
            </Button>
          </form>
        </Form>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Master Trade List</h4>
        <ScrollArea className="h-[300px] rounded-md border bg-card">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (trades?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Tag className="h-8 w-8 opacity-20" />
              <p className="text-sm italic">No trade categories defined.</p>
            </div>
          ) : (
            <div className="p-1">
              {trades?.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 rounded-sm hover:bg-muted/50 transition-colors group">
                  <span className="font-medium text-sm">{trade.name}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Trade Category?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{trade.name}" from the system selection list. Existing records using this trade will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteTrade(trade.id)} className="bg-destructive hover:bg-destructive/90">
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
