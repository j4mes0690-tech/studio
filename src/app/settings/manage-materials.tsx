'use client';

import { useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Tag, Ruler } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { Material } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const MaterialSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  unit: z.string().min(1, 'Unit is required.'),
  defaultPrice: z.coerce.number().min(0, 'Price must be positive.'),
});

export function ManageMaterials() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const materialsQuery = useMemo(() => query(collection(db, 'materials'), orderBy('name', 'asc')), [db]);
  const { data: materials, isLoading } = useCollection<Material>(materialsQuery);

  const form = useForm({
    resolver: zodResolver(MaterialSchema),
    defaultValues: { name: '', unit: 'pcs', defaultPrice: 0 },
  });

  const onSubmit = (values: any) => {
    startTransition(async () => {
      await addDoc(collection(db, 'materials'), values);
      toast({ title: 'Success', description: 'Material catalogue updated.' });
      form.reset();
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'materials', id));
      toast({ title: 'Success', description: 'Material removed.' });
    });
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 bg-muted/20 p-4 rounded-lg border">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Material Description</FormLabel><FormControl><Input placeholder="e.g. M20 Concrete Mix" className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-2 gap-2">
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Unit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="m3">Cubic Metres (m3)</SelectItem>
                    <SelectItem value="ton">Tonnes (ton)</SelectItem>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="m">Metres (m)</SelectItem>
                    <SelectItem value="sqm">Square Metres (m2)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="defaultPrice" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Std. Price (£)</FormLabel><FormControl><Input type="number" step="0.01" className="h-8 text-xs" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
            Add to Catalogue
          </Button>
        </form>
      </Form>

      <ScrollArea className="h-[300px] rounded-md border bg-card">
        <div className="p-2 space-y-2">
          {materials?.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-md border group bg-background">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{m.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono border">{m.unit}</span>
                  <span className="text-[10px] text-primary font-bold">£{m.defaultPrice?.toFixed(2)}</span>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Remove Material?</AlertDialogTitle><AlertDialogDescription>This will remove "{m.name}" from the standard catalogue.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(m.id)} className="bg-destructive">Remove</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          {materials?.length === 0 && !isLoading && <p className="text-center py-10 text-xs text-muted-foreground italic">No materials defined.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}
