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
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, ShoppingCart, Calendar, Users2, Clock, Info } from 'lucide-react';
import type { Project, SubContractor, ProcurementItem, ProcurementStatus } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { format, parseISO, subWeeks } from 'date-fns';

const EditProcurementSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  trade: z.string().min(1, 'Trade discipline is required.'),
  subcontractorId: z.string().optional().nullable(),
  warrantyRequired: z.boolean().default(false),
  tenderPeriodWeeks: z.coerce.number().min(1),
  leadInPeriodWeeks: z.coerce.number().min(0),
  startOnSiteDate: z.string().min(1, 'Start on site date is required.'),
  actualEnquiryDate: z.string().optional().nullable(),
  tenderReturnDate: z.string().optional().nullable(),
  orderPlacedDate: z.string().optional().nullable(),
  comments: z.string().optional().default(''),
  status: z.enum(['planned', 'enquiry', 'tender-returned', 'complete', 'on-site']),
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

  const form = useForm<EditProcurementFormValues>({
    resolver: zodResolver(EditProcurementSchema),
    defaultValues: {
      projectId: item.projectId,
      trade: item.trade,
      subcontractorId: item.subcontractorId,
      warrantyRequired: !!item.warrantyRequired,
      tenderPeriodWeeks: item.tenderPeriodWeeks,
      leadInPeriodWeeks: item.leadInPeriodWeeks,
      startOnSiteDate: item.startOnSiteDate || '',
      actualEnquiryDate: item.actualEnquiryDate,
      tenderReturnDate: item.tenderReturnDate,
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
        tenderPeriodWeeks: item.tenderPeriodWeeks,
        leadInPeriodWeeks: item.leadInPeriodWeeks,
        startOnSiteDate: item.startOnSiteDate || '',
        actualEnquiryDate: item.actualEnquiryDate,
        tenderReturnDate: item.tenderReturnDate,
        orderPlacedDate: item.orderPlacedDate,
        comments: item.comments || '',
        status: item.status,
      });
    }
  }, [open, item, form]);

  // AUTO-PROGRESSION LOGIC: If order date is populated, move status to 'complete'
  const orderDateValue = form.watch('orderPlacedDate');
  const statusValue = form.watch('status');

  useEffect(() => {
    if (orderDateValue && statusValue !== 'complete' && statusValue !== 'on-site') {
      form.setValue('status', 'complete');
    }
  }, [orderDateValue, statusValue, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  // CALCULATION LOGIC
  const startOnSiteDate = form.watch('startOnSiteDate');
  const tenderWeeks = form.watch('tenderPeriodWeeks');
  const leadInWeeks = form.watch('leadInPeriodWeeks');

  const calculatedDates = useMemo(() => {
    if (!startOnSiteDate) return null;
    try {
      const startDate = parseISO(startOnSiteDate);
      const latestOrderDate = subWeeks(startDate, leadInWeeks);
      const targetEnquiryDate = subWeeks(latestOrderDate, tenderWeeks);
      
      return {
        latestOrderDate: format(latestOrderDate, 'yyyy-MM-dd'),
        targetEnquiryDate: format(targetEnquiryDate, 'yyyy-MM-dd')
      };
    } catch (e) {
      return null;
    }
  }, [startOnSiteDate, tenderWeeks, leadInWeeks]);

  const onSubmit = (values: EditProcurementFormValues) => {
    if (!calculatedDates) return;

    startTransition(async () => {
      try {
        const sub = subContractors.find(s => s.id === values.subcontractorId);
        const docRef = doc(db, 'procurement-items', item.id);
        
        const updates = {
          ...values,
          subcontractorName: sub?.name || null,
          subcontractorId: values.subcontractorId === 'none' ? null : values.subcontractorId,
          targetEnquiryDate: calculatedDates.targetEnquiryDate,
          latestDateForOrder: calculatedDates.latestOrderDate,
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Procurement milestones revised.' });
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
          <DialogTitle>Edit Procurement Record: {item.reference}</DialogTitle>
          <DialogDescription>Revision of trade discipline milestones and appointment status.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="projectId" render={({ field }) => (
                        <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="trade" render={({ field }) => (
                        <FormItem><FormLabel>Trade Discipline</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><Users2 className="h-4 w-4" /> Appointed Partner</FormLabel><Select onValueChange={field.onChange} value={field.value || 'none'}><FormControl><SelectTrigger><SelectValue placeholder="Assign Sub" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">TBC</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Current Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="enquiry">Enquiry Issued</SelectItem><SelectItem value="tender-returned">Tender Returned</SelectItem><SelectItem value="complete">Complete</SelectItem><SelectItem value="on-site">On Site</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    <FormField control={form.control} name="warrantyRequired" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/5 mt-auto h-[40px]">
                            <FormLabel className="text-xs font-bold">Warranty?</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                </div>

                <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 space-y-6">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h4 className="font-bold text-primary text-sm uppercase tracking-widest">Base Milestones & Calculated Logic</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="startOnSiteDate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold">Start on Site Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="tenderPeriodWeeks" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold">Tender Period (Weeks)</FormLabel>
                                <FormControl><Input type="number" min="1" {...field} /></FormControl>
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="leadInPeriodWeeks" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-bold">Lead-In Period (Weeks)</FormLabel>
                                <FormControl><Input type="number" min="0" {...field} /></FormControl>
                            </FormItem>
                        )} />
                    </div>

                    {calculatedDates && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-primary/20 shadow-sm">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Calculated Latest Order</p>
                                <p className="text-sm font-bold text-primary">{new Date(calculatedDates.latestOrderDate).toLocaleDateString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Calculated Target Enquiry</p>
                                <p className="text-sm font-bold text-primary">{new Date(calculatedDates.targetEnquiryDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border border-dashed">
                    <FormField control={form.control} name="actualEnquiryDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Actual Enquiry Date</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="tenderReturnDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Tender Return Date</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
                    <FormField control={form.control} name="orderPlacedDate" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-bold uppercase text-muted-foreground">Order Placed</FormLabel><FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="comments" render={({ field }) => (
                        <FormItem><FormLabel>Management Comments</FormLabel><FormControl><Textarea className="min-h-[40px] h-10" {...field} /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            <DialogFooter className="p-6 bg-muted/10 border-t sticky bottom-0 gap-3">
              <Button type="button" variant="ghost" className="font-bold" onClick={() => onOpenChange(false)}>Discard</Button>
              <Button type="submit" className="flex-1 h-12 text-lg font-bold" disabled={isPending || !calculatedDates}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
