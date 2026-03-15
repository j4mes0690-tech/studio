'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Save, ShoppingCart, ShieldCheck, Users2, Calendar } from 'lucide-react';
import type { Project, SubContractor, ProcurementItem, Trade } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { addWeeks, format, parseISO } from 'date-fns';

const NewProcurementSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  subcontractorId: z.string().optional().nullable(),
  warrantyRequired: z.boolean().default(false),
  targetEnquiryDate: z.string().min(1, 'Target enquiry date is required.'),
  tenderPeriodWeeks: z.coerce.number().min(1).default(4),
  leadInPeriodWeeks: z.coerce.number().min(0).default(4),
  startOnSiteDate: z.string().optional().nullable(),
  comments: z.string().optional().default(''),
});

type NewProcurementFormValues = z.infer<typeof NewProcurementSchema>;

export function NewProcurementDialog({ 
  projects, 
  subContractors, 
  allProcurement,
  currentUser 
}: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allProcurement: ProcurementItem[];
  currentUser: any;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const tradesQuery = useMemoFirebase(() => (db ? collection(db, 'trades') : null), [db]);
  const { data: trades } = useCollection<Trade>(tradesQuery);

  const form = useForm<NewProcurementFormValues>({
    resolver: zodResolver(NewProcurementSchema),
    defaultValues: {
      projectId: '',
      trade: '',
      subcontractorId: null,
      warrantyRequired: false,
      targetEnquiryDate: new Date().toISOString().split('T')[0],
      tenderPeriodWeeks: 4,
      leadInPeriodWeeks: 4,
      startOnSiteDate: '',
      comments: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  const onSubmit = (values: NewProcurementFormValues) => {
    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allProcurement.map(p => ({ reference: p.reference, projectId: p.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'PROC', initials);
        
        const subcontractor = subContractors.find(s => s.id === values.subcontractorId);

        const procurementData: Omit<ProcurementItem, 'id'> = {
          reference,
          projectId: values.projectId,
          trade: values.trade,
          subcontractorId: values.subcontractorId || null,
          subcontractorName: subcontractor?.name || null,
          warrantyRequired: values.warrantyRequired,
          targetEnquiryDate: values.targetEnquiryDate,
          tenderPeriodWeeks: values.tenderPeriodWeeks,
          actualEnquiryDate: null,
          tenderReturnDate: null,
          latestDateForOrder: null,
          leadInPeriodWeeks: values.leadInPeriodWeeks,
          startOnSiteDate: values.startOnSiteDate || null,
          preContractMeetingDate: null,
          orderPlacedDate: null,
          comments: values.comments || '',
          status: 'planned',
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'procurement-items'), procurementData);
        toast({ title: 'Success', description: 'Trade procurement record initialized.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save procurement item.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20">
          <PlusCircle className="h-4 w-4" />
          Schedule Procurement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle>New Procurement Entry</DialogTitle>
                <DialogDescription>Initialize a new trade package for the project tender schedule.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger></FormControl>
                            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                )} />

                <FormField control={form.control} name="trade" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Trade Discipline</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {trades?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" /> Appointed Partner (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'none'}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose appointed sub" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">TBC / Not Appointed</SelectItem>
                                {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />

                <FormField control={form.control} name="warrantyRequired" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/10">
                        <div className="space-y-0.5">
                            <FormLabel className="text-sm font-bold">Warranty Required?</FormLabel>
                            <FormDescription className="text-[10px]">Flag if collateral warranties are a contract condition.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />
            </div>

            <Separator />

            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h4 className="font-bold text-primary text-sm uppercase tracking-widest">Enquiry & Lead Planning</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="targetEnquiryDate" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Target Enquiry Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="tenderPeriodWeeks" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Tender Period (Weeks)</FormLabel>
                            <FormControl><Input type="number" min="1" {...field} /></FormControl>
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="leadInPeriodWeeks" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Lead-In Period (Weeks)</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} /></FormControl>
                        </FormItem>
                    )} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="startOnSiteDate" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Start on Site Date</FormLabel>
                        <FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />

                <FormField control={form.control} name="comments" render={({ field }) => (
                    <FormItem>
                        <FormLabel>General Comments</FormLabel>
                        <FormControl><Textarea placeholder="Any specific requirements or tender notes..." className="min-h-[80px]" {...field} /></FormControl>
                    </FormItem>
                )} />
            </div>

            <DialogFooter className="border-t pt-6 gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
              <Button type="submit" className="flex-1 h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Log Procurement Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
