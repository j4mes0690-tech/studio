'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ProcurementItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Loader2, 
  ShoppingCart,
  Clock,
  Users2,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Building2,
  Pencil
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
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
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
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

  const isCompleted = item.status === 'ordered' || item.status === 'on-site';

  const statusConfig = {
    'planned': { label: 'Planned', color: 'bg-slate-100 text-slate-800' },
    'enquiry': { label: 'Tendering', color: 'bg-blue-100 text-blue-800' },
    'tender-returned': { label: 'Evaluating', color: 'bg-amber-100 text-amber-800' },
    'ordered': { label: 'Ordered', color: 'bg-green-100 text-green-800' },
    'on-site': { label: 'On Site', color: 'bg-indigo-100 text-indigo-800' },
  };

  const currentStatus = statusConfig[item.status];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'procurement-items', item.id));
      toast({ title: 'Removed', description: 'Procurement item deleted.' });
    });
  };

  const milestones = [
    { label: 'Enquiry', date: item.actualEnquiryDate || item.targetEnquiryDate, isActual: !!item.actualEnquiryDate },
    { label: 'Return', date: item.tenderReturnDate, isActual: !!item.tenderReturnDate },
    { label: 'Order', date: item.orderPlacedDate || item.latestDateForOrder, isActual: !!item.orderPlacedDate },
    { label: 'Start', date: item.startOnSiteDate, isActual: !!item.startOnSiteDate },
  ];

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          isCompleted ? "border-l-green-500 bg-green-50/5" : "border-l-primary"
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
              <Badge className={cn("capitalize text-[9px] font-black tracking-tight", currentStatus.color)}>
                {currentStatus.label}
              </Badge>
              
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Remove from Schedule</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete Procurement Entry?</AlertDialogTitle><AlertDialogDescription>This will remove the procurement record for {item.trade}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {milestones.map((ms, i) => (
              <div key={i} className={cn(
                "p-2 rounded-lg border flex flex-col items-center text-center gap-1",
                ms.isActual ? "bg-primary/5 border-primary/20 shadow-inner" : "bg-muted/30 border-dashed"
              )}>
                <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter">{ms.label}</span>
                <span className={cn("text-[10px] font-bold", ms.isActual ? "text-primary" : "text-muted-foreground")}>
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
