'use client';

import { useTransition, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ShoppingCart, Calendar, Users2 } from 'lucide-react';
import type { Project, SubContractor, ProcurementItem, Trade, ProcurementStatus } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const EditProcurementSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  subcontractorId: z.string().optional().nullable(),
  warrantyRequired: z.boolean().default(false),
  targetEnquiryDate: z.string().min(1),
  tenderPeriodWeeks: z.coerce.number().min(1),
  actualEnquiryDate: z.string().optional().nullable(),
  tenderReturnDate: z.string().optional().nullable(),
  latestDateForOrder: z.string().optional().nullable(),
  leadInPeriodWeeks: z.coerce.number().min(0),
  startOnSiteDate: z.string().optional().nullable(),
  preContractMeetingDate: z.string().optional().nullable(),
  orderPlacedDate: z.string().optional().nullable(),
  comments: z.string().optional().default(''),
  status: z.enum(['planned', 'enquiry', 'tender-returned', 'ordered', 'on-site']),
});

type EditProcurementFormValues = z.infer<typeof EditProcurementSchema>;

export function EditProcurementDialog({ 
  item,
  projects, 
  subContractors,
  open,
  onOpenChange
}: { 
  item: ProcurementItem;
  projects: Project[]; 
  subContractors: SubContractor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemoFirebase(() => (db ? collection(db, 'trades') : null), [db]);
  const { data: trades } = useCollection<Trade>(tradesQuery);

  const form = useForm<EditProcurementFormValues>({
    resolver: zodResolver(EditProcurementSchema),
    defaultValues: {
      projectId: item.projectId,
      trade: item.trade,
      subcontractorId: item.subcontractorId,
      warrantyRequired: !!item.warrantyRequired,
      targetEnquiryDate: item.targetEnquiryDate,
      tenderPeriodWeeks: item.tenderPeriodWeeks,
      actualEnquiryDate: item.actualEnquiryDate,
      tenderReturnDate: item.tenderReturnDate,
      latestDateForOrder: item.latestDateForOrder,
      leadInPeriodWeeks: item.leadInPeriodWeeks,
      startOnSiteDate: item.startOnSiteDate,
      preContractMeetingDate: item.preContractMeetingDate,
      orderPlacedDate: item.orderPlacedDate,
      comments: item.comments || '',
      status: item.status,
    },
  });

  useEffect(() => {
    if (open && item) {
      form.reset({
        projectId: item.projectId,
        trade: item.trade,
        subcontractorId: item.subcontractorId,
        warrantyRequired: !!item.warrantyRequired,
        targetEnquiryDate: item.targetEnquiryDate,
        tenderPeriodWeeks: item.tenderPeriodWeeks,
        actualEnquiryDate: item.actualEnquiryDate,
        tenderReturnDate: item.tenderReturnDate,
        latestDateForOrder: item.latestDateForOrder,
        leadInPeriodWeeks: item.leadInPeriodWeeks,
        startOnSiteDate: item.startOnSiteDate,
        preContractMeetingDate: item.preContractMeetingDate,
        orderPlacedDate: item.orderPlacedDate,
        comments: item.comments || '',
        status: item.status,
      });
    }
  }, [open, item, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  const onSubmit = (values: EditProcurementFormValues) => {
    startTransition(async () => {
      try {
        const sub = subContractors.find(s => s.id === values.subcontractorId);
        const docRef = doc(db, 'procurement-items', item.id);
        
        const updates = {
          ...values,
          subcontractorName: sub?.name || null,
          subcontractorId: values.subcontractorId === 'none' ? null : values.subcontractorId,
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Procurement status updated.' });
        onOpenChange(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Procurement: {item.reference}</DialogTitle>
          <DialogDescription>Update milestones and process status for this trade package.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="projectId" render={({ field }) => (
                        <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="trade" render={({ field }) => (
                        <FormItem><FormLabel>Trade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{trades?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><Users2 className="h-4 w-4" /> Appointed Partner</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'}><FormControl><SelectTrigger><SelectValue placeholder="Assign Sub" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">TBC</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Current Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="enquiry">Enquiry Issued</SelectItem><SelectItem value="tender-returned">Tender Returned</SelectItem><SelectItem value="ordered">Ordered</SelectItem><SelectItem value="on-site">On Site</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="warrantyRequired" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/5 mt-auto h-[40px]">
                            <FormLabel className="text-xs font-bold">Warranty?</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-4 rounded-lg border border-dashed">
                    <FormField control={form.control} name="targetEnquiryDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Target Enquiry</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="actualEnquiryDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Actual Enquiry</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="tenderReturnDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Tender Return</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                    <FormField control={form.control} name="latestDateForOrder" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Latest Order Date</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="orderPlacedDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Order Placed</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="preContractMeetingDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Pre-Contract Mtg</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="startOnSiteDate" render={({ field }) => (
                        <FormItem><FormLabel>Actual Start on Site</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="comments" render={({ field }) => (
                        <FormItem><FormLabel>Management Comments</FormLabel><FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            <DialogFooter className="p-6 bg-muted/10 border-t sticky bottom-0 gap-3">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Commit Updates
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
