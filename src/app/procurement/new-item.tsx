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
import { PlusCircle, Loader2, Save, ShoppingCart, Users2, Calendar, Clock, Info, CheckCircle2 } from 'lucide-react';
import type { Project, SubContractor, ProcurementItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { format, parseISO, subWeeks } from 'date-fns';

const NewProcurementSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  trade: z.string().min(1, 'Trade description is required.'),
  subcontractorId: z.string().optional().nullable(),
  warrantyRequired: z.boolean().default(false),
  tenderPeriodWeeks: z.coerce.number().min(1, 'Minimum 1 week tender period.').default(4),
  leadInPeriodWeeks: z.coerce.number().min(0).default(4),
  startOnSiteDate: z.string().min(1, 'Start on site date is required.'),
  comments: z.string().optional().default(''),
});

type NewProcurementFormValues = z.infer<typeof NewProcurementSchema>;

export function NewProcurementDialog({ 
  projects, 
  subContractors, 
  allProcurement,
  currentUser,
  initialProjectId
}: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allProcurement: ProcurementItem[];
  currentUser: any;
  initialProjectId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewProcurementFormValues>({
    resolver: zodResolver(NewProcurementSchema),
    defaultValues: {
      projectId: initialProjectId || '',
      trade: '',
      subcontractorId: null,
      warrantyRequired: false,
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

  const onSubmit = (values: NewProcurementFormValues, shouldClose: boolean = true) => {
    if (!calculatedDates) return;

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
          targetEnquiryDate: calculatedDates.targetEnquiryDate,
          tenderPeriodWeeks: values.tenderPeriodWeeks,
          actualEnquiryDate: null,
          tenderReturnDate: null,
          latestDateForOrder: calculatedDates.latestOrderDate,
          leadInPeriodWeeks: values.leadInPeriodWeeks,
          startOnSiteDate: values.startOnSiteDate,
          orderPlacedDate: null,
          comments: values.comments || '',
          status: 'planned',
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'procurement-items'), procurementData);
        toast({ title: 'Success', description: `Trade package "${values.trade}" recorded.` });
        
        // Reset for next entry
        form.reset({
            ...values,
            trade: '',
            subcontractorId: null,
            comments: '',
        });

        if (shouldClose) {
          setOpen(false);
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save procurement item.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (open) {
        form.reset({
            projectId: initialProjectId || '',
            trade: '',
            subcontractorId: null,
            warrantyRequired: false,
            tenderPeriodWeeks: 4,
            leadInPeriodWeeks: 4,
            startOnSiteDate: '',
            comments: '',
        });
    }
  }, [open, initialProjectId, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20 font-bold">
          <PlusCircle className="h-4 w-4" />
          Log Trade Package
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle>Rapid Procurement Logging</DialogTitle>
                <DialogDescription>Input site milestones to calculate enquiry dates. Add multiple items in sequence.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => onSubmit(v, true))} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!initialProjectId}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger></FormControl>
                            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                )} />

                <FormField control={form.control} name="trade" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Trade Discipline</FormLabel>
                        <FormControl><Input placeholder="e.g. Structural Steelwork" {...field} /></FormControl>
                        <FormMessage />
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
                    <h4 className="font-bold text-primary text-sm uppercase tracking-widest">Site Milestones & Lead Times</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="startOnSiteDate" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-bold">Required Start on Site</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="tenderPeriodWeeks" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-bold">Tender Period (Weeks)</FormLabel>
                            <FormControl><Input type="number" min="1" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="leadInPeriodWeeks" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-bold">Lead-In Period (Weeks)</FormLabel>
                            <FormControl><Input type="number" min="0" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                {calculatedDates && (
                    <div className="mt-6 p-4 bg-white rounded-lg border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-3">
                            <Clock className="h-3.5 w-3.5" />
                            Calculated Procurement Logic
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Latest Order Date</p>
                                <p className="text-sm font-bold text-primary">{new Date(calculatedDates.latestOrderDate).toLocaleDateString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Target Enquiry Date</p>
                                <p className="text-sm font-bold text-primary">{new Date(calculatedDates.targetEnquiryDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <FormField control={form.control} name="comments" render={({ field }) => (
                <FormItem>
                    <FormLabel>General Management Comments</FormLabel>
                    <FormControl><Textarea placeholder="Any specific requirements or tender notes..." className="min-h-[80px]" {...field} /></FormControl>
                </FormItem>
            )} />

            <DialogFooter className="flex flex-col sm:flex-row border-t pt-6 gap-3">
              <Button type="button" variant="ghost" className="font-bold text-muted-foreground order-last sm:order-first" onClick={() => setOpen(false)} disabled={isPending}>Discard</Button>
              <div className="hidden sm:block flex-1" />
              <Button 
                type="button" 
                variant="outline" 
                className="h-12 px-6 font-bold gap-2 border-primary/30 text-primary" 
                disabled={isPending || !calculatedDates}
                onClick={form.handleSubmit((v) => onSubmit(v, false))}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} 
                Add & Continue
              </Button>
              <Button type="submit" className="h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20" disabled={isPending || !calculatedDates}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Log & Finish
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
