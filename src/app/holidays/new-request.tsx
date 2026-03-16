'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Save, Sun, Calculator } from 'lucide-react';
import type { HolidayRequest, DistributionUser } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, parseISO, isValid } from 'date-fns';

const NewRequestSchema = z.object({
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  type: z.enum(['holiday', 'sick', 'other']).default('holiday'),
  notes: z.string().optional(),
}).refine(data => {
    const start = parseISO(data.startDate);
    const end = parseISO(data.endDate);
    return end >= start;
}, {
    message: "End date cannot be before start date.",
    path: ["endDate"]
});

type NewRequestFormValues = z.infer<typeof NewRequestSchema>;

export function NewHolidayRequest({ currentUser }: { currentUser: DistributionUser }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewRequestFormValues>({
    resolver: zodResolver(NewRequestSchema),
    defaultValues: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      type: 'holiday',
      notes: '',
    },
  });

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (!isValid(s) || !isValid(e)) return 0;
    return Math.max(1, differenceInDays(e, s) + 1);
  }, [startDate, endDate]);

  const onSubmit = (values: NewRequestFormValues) => {
    startTransition(async () => {
      try {
        const requestData: Omit<HolidayRequest, 'id'> = {
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          startDate: values.startDate,
          endDate: values.endDate,
          totalDays,
          type: values.type,
          notes: values.notes || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'holiday-requests'), requestData);
        toast({ title: 'Request Submitted', description: 'Your leave request has been sent for approval.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to submit request.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-bold h-10 shadow-lg shadow-primary/20">
          <PlusCircle className="h-4 w-4" />
          Request Leave
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Sun className="h-5 w-5" />
            </div>
            <DialogTitle>Book Time Off</DialogTitle>
          </div>
          <DialogDescription>Submit a formal leave request for approval.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                    <FormLabel>Leave Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="holiday">Holiday / Annual Leave</SelectItem>
                            <SelectItem value="sick">Sickness / Medical</SelectItem>
                            <SelectItem value="other">Other (Specify in notes)</SelectItem>
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <div className="bg-muted/30 p-3 rounded-lg border border-dashed flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <Calculator className="h-4 w-4 text-primary" />
                    Total Days
                </div>
                <Badge variant="secondary" className="h-7 px-3 text-sm font-bold text-primary">{totalDays} Calendar Days</Badge>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Comments (Optional)</FormLabel><FormControl><Textarea placeholder="Reason or specific details..." className="min-h-[80px]" {...field} /></FormControl></FormItem>
            )} />

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
