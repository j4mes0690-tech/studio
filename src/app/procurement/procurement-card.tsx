'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ProcurementItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Loader2, 
  Clock,
  Pencil,
  AlertTriangle,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, startOfDay, isAfter } from 'date-fns';
import { EditProcurementDialog } from './edit-item';

export function ProcurementCard({ 
  item, 
  project, 
  projects,
  subContractors,
  currentUser
}: { 
  item: ProcurementItem; 
  project?: Project; 
  projects: Project[];
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // AUTOMATED RAG STATUS LOGIC
  const rag = useMemo(() => {
    const today = startOfDay(new Date());
    
    // Phase 1: Already Ordered
    if (item.orderPlacedDate) {
      return { color: 'text-green-600', border: 'border-l-green-500', bg: 'bg-green-50', label: 'Ordered', icon: CheckCircle2 };
    }

    // Phase 2: Enquiry Sent, Tracking Order Date
    if (item.actualEnquiryDate) {
      if (!item.latestDateForOrder) return { color: 'text-slate-400', border: 'border-l-slate-300', bg: 'bg-slate-100', label: 'Tendering' };
      
      const target = startOfDay(parseISO(item.latestDateForOrder));
      const daysUntil = differenceInDays(target, today);

      if (daysUntil < 0) return { color: 'text-red-600', border: 'border-l-red-500', bg: 'bg-red-50', label: 'Order Overdue', icon: AlertTriangle };
      if (daysUntil <= 14) return { color: 'text-amber-600', border: 'border-l-amber-500', bg: 'bg-amber-50', label: 'Order Due Soon', icon: Clock };
      return { color: 'text-green-600', border: 'border-l-green-500', bg: 'bg-green-50', label: 'Tendering', icon: CheckCircle2 };
    }

    // Phase 3: Planning, Tracking Enquiry Date
    if (!item.targetEnquiryDate) return { color: 'text-slate-400', border: 'border-l-slate-300', bg: 'bg-slate-100', label: 'No Schedule' };

    const target = startOfDay(parseISO(item.targetEnquiryDate));
    const daysUntil = differenceInDays(target, today);

    if (daysUntil < 0) return { color: 'text-red-600', border: 'border-l-red-500', bg: 'bg-red-50', label: 'Enquiry Overdue', icon: AlertTriangle };
    if (daysUntil <= 14) return { color: 'text-amber-600', border: 'border-l-amber-500', bg: 'bg-amber-50', label: 'Enquiry Due Soon', icon: Clock };
    return { color: 'text-green-600', border: 'border-l-green-500', bg: 'bg-green-50', label: 'On Track', icon: CheckCircle2 };
  }, [item.orderPlacedDate, item.actualEnquiryDate, item.targetEnquiryDate, item.latestDateForOrder]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'procurement-items', item.id));
      toast({ title: 'Removed', description: 'Procurement item deleted.' });
    });
  };

  const getMilestoneColor = (actual: string | null, target: string | null) => {
    if (!actual || !target) return "text-muted-foreground";
    const dActual = startOfDay(parseISO(actual));
    const dTarget = startOfDay(parseISO(target));
    return isAfter(dActual, dTarget) ? "text-red-600" : "text-green-600";
  };

  const milestones = [
    { 
      label: item.actualEnquiryDate ? 'Actual Enquiry' : 'Due Enquiry', 
      date: item.actualEnquiryDate || item.targetEnquiryDate, 
      isActual: !!item.actualEnquiryDate,
      color: getMilestoneColor(item.actualEnquiryDate, item.targetEnquiryDate)
    },
    { 
      label: 'Tender Return', 
      date: item.tenderReturnDate, 
      isActual: !!item.tenderReturnDate,
      color: "text-muted-foreground" 
    },
    { 
      label: item.orderPlacedDate ? 'Actual Order' : 'Due Order', 
      date: item.orderPlacedDate || item.latestDateForOrder, 
      isActual: !!item.orderPlacedDate,
      color: getMilestoneColor(item.orderPlacedDate, item.latestDateForOrder)
    },
    { 
      label: 'Site Start', 
      date: item.startOnSiteDate, 
      isActual: !!item.startOnSiteDate,
      color: "text-muted-foreground"
    },
  ];

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          rag.border,
          item.orderPlacedDate && "bg-green-50/5"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/20">
                  {item.reference}
                </Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {item.trade}
                </CardTitle>
              </div>
              <CardDescription className="font-semibold text-foreground flex items-center gap-2">
                {project?.name || 'Unknown Project'} • {item.subcontractorName || 'TBC Partner'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsEditDialogOpen(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Edit Milestone</p></TooltipContent>
                </Tooltip>

                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Remove from Schedule</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete Procurement Entry?</AlertDialogTitle><AlertDialogDescription>This will remove the procurement record for {item.trade}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("px-3 py-1.5 rounded-md flex items-center justify-between", rag.bg)}>
              <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", rag.color)}>
                  {rag.icon && <rag.icon className="h-3.5 w-3.5" />}
                  {rag.label}
              </div>
              <div className={cn("text-[9px] font-bold", rag.color)}>
                  {!item.actualEnquiryDate ? 'Next: Enquiry' : !item.orderPlacedDate ? 'Next: Order' : 'Project Committed'}
              </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {milestones.map((ms, i) => (
              <div key={i} className={cn(
                "p-2 rounded-lg border flex flex-col items-center text-center gap-1",
                ms.isActual ? "bg-primary/5 border-primary/20 shadow-inner" : "bg-muted/30 border-dashed"
              )}>
                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">{ms.label}</span>
                <span className={cn("text-[10px] font-bold", ms.color)}>
                  {ms.date ? new Date(ms.date).toLocaleDateString() : 'TBC'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Lead-in: <strong>{item.leadInPeriodWeeks}w</strong></span>
                </div>
                {item.warrantyRequired && (
                    <Badge variant="secondary" className="h-4 px-1.5 bg-amber-50 text-amber-700 text-[8px] font-bold">Warranty Required</Badge>
                )}
            </div>
            {item.comments && (
                <span className="truncate max-w-[150px] italic">"{item.comments}"</span>
            )}
          </div>
        </CardContent>
      </Card>

      <EditProcurementDialog 
        item={item} 
        projects={projects} 
        subContractors={subContractors} 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
