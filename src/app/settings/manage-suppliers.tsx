
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, User, Mail, MapPin } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { Supplier } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const SupplierSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  contactPerson: z.string().min(1, 'Contact person is required.'),
  email: z.string().email('Invalid email address.'),
});

export function ManageSuppliers() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const suppliersQuery = useMemo(() => query(collection(db, 'suppliers'), orderBy('name', 'asc')), [db]);
  const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery);

  const form = useForm({
    resolver: zodResolver(SupplierSchema),
    defaultValues: { name: '', contactPerson: '', email: '' },
  });

  const onSubmit = (values: any) => {
    startTransition(async () => {
      await addDoc(collection(db, 'suppliers'), values);
      toast({ title: 'Success', description: 'Supplier added.' });
      form.reset();
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'suppliers', id));
      toast({ title: 'Success', description: 'Supplier removed.' });
    });
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 bg-muted/20 p-4 rounded-lg border">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Company Name</FormLabel><FormControl><Input placeholder="e.g. Concrete Supply Co." className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-2">
            <FormField control={form.control} name="contactPerson" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Contact Name</FormLabel><FormControl><Input placeholder="John Doe" className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Email</FormLabel><FormControl><Input placeholder="sales@supply.com" className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
            Add Supplier
          </Button>
        </form>
      </Form>

      <ScrollArea className="h-[300px] rounded-md border bg-card">
        <div className="p-2 space-y-2">
          {suppliers?.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-md border group bg-background">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{s.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-2 w-2" /> {s.contactPerson}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="h-2 w-2" /> {s.email}</span>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Supplier?</AlertDialogTitle><AlertDialogDescription>This will remove "{s.name}" from the supplier directory.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(s.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          {suppliers?.length === 0 && !isLoading && <p className="text-center py-10 text-xs text-muted-foreground italic">No suppliers registered.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}
