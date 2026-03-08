
'use client';

import { useTransition, useEffect } from 'react';
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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import type { Project, SubContractor, SubContractOrder, SubContractOrderStatus } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const EditSubContractOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  subcontractorId: z.string().min(1, 'Subcontractor is required.'),
  description: z.string().min(3, 'Description is required.'),
  draftedDate: z.string().optional().nullable(),
  sentForApprovalDate: z.string().optional().nullable(),
  loadedOnDocuSignDate: z.string().optional().nullable(),
  signedDate: z.string().optional().nullable(),
});

type EditSubContractOrderFormValues = z.infer<typeof EditSubContractOrderSchema>;

export function EditSubContractOrderDialog({ 
  order,
  projects, 
  subContractors,
  open,
  onOpenChange
}: { 
  order: SubContractOrder;
  projects: Project[]; 
  subContractors: SubContractor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditSubContractOrderFormValues>({
    resolver: zodResolver(EditSubContractOrderSchema),
    defaultValues: {
      projectId: order.projectId,
      subcontractorId: order.subcontractorId,
      description: order.description,
      draftedDate: order.draftedDate,
      sentForApprovalDate: order.sentForApprovalDate,
      loadedOnDocuSignDate: order.loadedOnDocuSignDate,
      signedDate: order.signedDate,
    },
  });

  useEffect(() => {
    if (open && order) {
      form.reset({
        projectId: order.projectId,
        subcontractorId: order.subcontractorId,
        description: order.description,
        draftedDate: order.draftedDate,
        sentForApprovalDate: order.sentForApprovalDate,
        loadedOnDocuSignDate: order.loadedOnDocuSignDate,
        signedDate: order.signedDate,
      });
    }
  }, [open, order, form]);

  const getCalculatedStatus = (values: EditSubContractOrderFormValues): SubContractOrderStatus => {
    if (values.signedDate) return 'completed';
    if (values.loadedOnDocuSignDate) return 'docusign';
    if (values.sentForApprovalDate) return 'pending-approval';
    return 'draft';
  };

  const onSubmit = (values: EditSubContractOrderFormValues) => {
    startTransition(async () => {
      try {
        const sub = subContractors.find(s => s.id === values.subcontractorId);
        const docRef = doc(db, 'subcontract-orders', order.id);
        
        const updates = {
          projectId: values.projectId,
          subcontractorId: values.subcontractorId,
          subcontractorName: sub?.name || order.subcontractorName,
          description: values.description,
          draftedDate: values.draftedDate || null,
          sentForApprovalDate: values.sentForApprovalDate || null,
          loadedOnDocuSignDate: values.loadedOnDocuSignDate || null,
          signedDate: values.signedDate || null,
          status: getCalculatedStatus(values),
        };

        await updateDoc(docRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        toast({ title: 'Success', description: 'Tracking record updated.' });
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Sub Contract: {order.reference}</DialogTitle>
          <DialogDescription>Update the agreement status and milestones.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                <FormItem><FormLabel>Subcontractor</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{subContractors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Order Summary</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="draftedDate" render={({ field }) => (
                <FormItem><FormLabel>Date Drafted</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="sentForApprovalDate" render={({ field }) => (
                <FormItem><FormLabel>Sent for Approval</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="loadedOnDocuSignDate" render={({ field }) => (
                <FormItem><FormLabel>Loaded on DocuSign</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="signedDate" render={({ field }) => (
                <FormItem><FormLabel>Date Signed</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Update Tracking Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
