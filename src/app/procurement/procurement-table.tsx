'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ProcurementItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Loader2, Pencil, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { EditProcurementDialog } from './edit-item';
import { differenceInDays, parseISO, startOfDay, isAfter } from 'date-fns';

export function ProcurementTable({ 
  items, 
  projects, 
  subContractors,
  currentUser
}: { 
  items: ProcurementItem[]; 
  projects: Project[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Ref</TableHead>
            <TableHead>Trade Discipline</TableHead>
            <TableHead className="w-[150px]">Appointed Partner</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[130px]">Schedule</TableHead>
            <TableHead className="w-[100px] text-center">Enquiry</TableHead>
            <TableHead className="w-[100px] text-center">Return</TableHead>
            <TableHead className="w-[100px] text-center">Order</TableHead>
            <TableHead className="w-[100px] text-center">Site Start</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <ProcurementTableRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              subContractors={subContractors} 
              currentUser={currentUser}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProcurementTableRow({ 
  item, 
  projects, 
  subContractors,
  currentUser
}: { 
  item: ProcurementItem; 
  projects: Project[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // RAG STATUS LOGIC
  const rag = useMemo(() => {
    if (item.status === 'ordered' || item.status === 'on-site') {
      return { color: 'text-green-600', icon: CheckCircle2, label: 'On Track' };
    }

    const today = startOfDay(new Date());
    const targetDateStr = (item.status === 'planned') ? item.targetEnquiryDate : item.latestDateForOrder;
    
    if (!targetDateStr) return { color: 'text-slate-400', label: '---' };

    const target = startOfDay(parseISO(targetDateStr));
    const daysUntil = differenceInDays(target, today);

    if (daysUntil < 0) {
      return { color: 'text-red-600', icon: AlertTriangle, label: 'Overdue' };
    }
    if (daysUntil <= 14) {
      return { color: 'text-amber-600', icon: Clock, label: 'Due Soon' };
    }
    return { color: 'text-green-600', icon: CheckCircle2, label: 'Ahead' };
  }, [item.status, item.targetEnquiryDate, item.latestDateForOrder]);

  const statusConfig = {
    'planned': { label: 'Planned', color: 'bg-slate-100 text-slate-800' },
    'enquiry': { label: 'Tendering', color: 'bg-blue-100 text-blue-800' },
    'tender-returned': { label: 'Evaluating', color: 'bg-amber-100 text-amber-800' },
    'ordered': { label: 'Order Placed', color: 'bg-green-100 text-green-800' },
    'on-site': { label: 'On Site', color: 'bg-indigo-100 text-indigo-800' },
  };

  const currentStatus = statusConfig[item.status];

  const getMilestoneColor = (actual: string | null, target: string | null) => {
    if (!actual || !target) return "text-muted-foreground";
    const dActual = startOfDay(parseISO(actual));
    const dTarget = startOfDay(parseISO(target));
    return isAfter(dActual, dTarget) ? "text-red-600" : "text-green-600";
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'procurement-items', item.id));
      toast({ title: 'Removed', description: 'Item deleted.' });
    });
  };

  return (
    <>
      <TableRow 
        className={cn("group cursor-pointer", item.status === 'on-site' && "opacity-75")}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
        <TableCell className="font-bold text-sm truncate max-w-[180px]" title={item.trade}>{item.trade}</TableCell>
        <TableCell className="truncate max-w-[150px] text-xs font-semibold">{item.subcontractorName || 'TBC'}</TableCell>
        <TableCell>
          <Badge className={cn("capitalize text-[10px] font-bold h-5", currentStatus.color)}>
            {currentStatus.label}
          </Badge>
        </TableCell>
        <TableCell>
            <div className={cn("flex items-center gap-1.5 text-[10px] font-bold", rag.color)}>
                {rag.icon && <rag.icon className="h-3 w-3" />}
                {rag.label}
            </div>
        </TableCell>
        <TableCell className={cn("text-center font-mono text-[10px] font-bold", getMilestoneColor(item.actualEnquiryDate, item.targetEnquiryDate))}>
            {item.actualEnquiryDate ? new Date(item.actualEnquiryDate).toLocaleDateString() : (item.targetEnquiryDate ? new Date(item.targetEnquiryDate).toLocaleDateString() : '---')}
        </TableCell>
        <TableCell className="text-center font-mono text-[10px]">
            {item.tenderReturnDate ? new Date(item.tenderReturnDate).toLocaleDateString() : '---'}
        </TableCell>
        <TableCell className={cn("text-center font-mono text-[10px] font-bold", getMilestoneColor(item.orderPlacedDate, item.latestDateForOrder))}>
            {item.orderPlacedDate ? new Date(item.orderPlacedDate).toLocaleDateString() : (item.latestDateForOrder ? new Date(item.latestDateForOrder).toLocaleDateString() : '---')}
        </TableCell>
        <TableCell className="text-center font-mono text-[10px] font-bold text-primary">
            {item.startOnSiteDate ? new Date(item.startOnSiteDate).toLocaleDateString() : '---'}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsEditDialogOpen(true)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Edit Item</p></TooltipContent>
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
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>

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
