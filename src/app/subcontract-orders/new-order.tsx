
'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Save, FileSignature } from 'lucide-react';
import type { Project, SubContractor, DistributionUser, SubContractOrder, SubContractOrderStatus } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';

const NewSubContractOrderSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  subcontractorId: z.string().min(1, 'Subcontractor is required.'),
  description: z.string().min(3, 'Description is required.'),
  draftedDate: z.string().optional().nullable(),
  sentForApprovalDate: z.string().optional().nullable(),
  loadedOnDocuSignDate: z.string().optional().nullable(),
  signedDate: z.string().optional().nullable(),
});

type NewSubContractOrderFormValues = z.infer<typeof NewSubContractOrderSchema>;

export function NewSubContractOrderDialog({ projects, subContractors, allOrders, currentUser }: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allOrders: SubContractOrder[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewSubContractOrderFormValues>({
    resolver: zodResolver(NewSubContractOrderSchema),
    defaultValues: {
      projectId: '',
      subcontractorId: '',
      description: '',
      draftedDate: new Date().toISOString().split('T')[0],
      sentForApprovalDate: null,
      loadedOnDocuSignDate: null,
      signedDate: null,
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const getCalculatedStatus = (values: NewSubContractOrderFormValues): SubContractOrderStatus => {
    if (values.signedDate) return 'completed';
    if (values.loadedOnDocuSignDate) return 'docusign';
    if (values.sentForApprovalDate) return 'pending-approval';
    return 'draft';
  };

  const onSubmit = (values: NewSubContractOrderFormValues) => {
    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allOrders.map(o => ({ reference: o.reference, projectId: o.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'SC', initials);
        const sub = subContractors.find(s => s.id === values.subcontractorId);

        const orderData = {
          reference,
          projectId: values.projectId,
          subcontractorId: values.subcontractorId,
          subcontractorName: sub?.name || 'Unknown',
          description: values.description,
          draftedDate: values.draftedDate || null,
          sentForApprovalDate: values.sentForApprovalDate || null,
          loadedOnDocuSignDate: values.loadedOnDocuSignDate || null,
          signedDate: values.signedDate || null,
          status: getCalculatedStatus(values),
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'subcontract-orders'), orderData).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'subcontract-orders',
            operation: 'create',
            requestResourceData: orderData,
          }));
          throw error;
        });

        toast({ title: 'Success', description: 'Sub contract order tracked.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save order.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />Add Subcontract Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Subcontract Order</DialogTitle>
          <DialogDescription>Initiate tracking for a new subcontractor agreement.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
              <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                <FormItem><FormLabel>Subcontractor</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger></FormControl><SelectContent>{subContractors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Order Summary</FormLabel><FormControl><Input placeholder="e.g. Partitioning Package" {...field} /></FormControl></FormItem>
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
                Log Order Tracking
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
