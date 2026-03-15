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
import { Trash2, Loader2, Pencil, Clock, AlertTriangle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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

type SortKey = 'reference' | 'trade' | 'subcontractor' | 'schedule' | 'enquiry' | 'return' | 'order' | 'start';
type SortOrder = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('trade');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'reference':
          valA = a.reference;
          valB = b.reference;
          break;
        case 'trade':
          valA = a.trade;
          valB = b.trade;
          break;
        case 'subcontractor':
          valA = a.subcontractorName || 'ZZZ';
          valB = b.subcontractorName || 'ZZZ';
          break;
        case 'enquiry':
          valA = a.actualEnquiryDate || a.targetEnquiryDate || '';
          valB = b.actualEnquiryDate || b.targetEnquiryDate || '';
          break;
        case 'return':
          valA = a.tenderReturnDate || '';
          valB = b.tenderReturnDate || '';
          break;
        case 'order':
          valA = a.orderPlacedDate || a.latestDateForOrder || '';
          valB = b.orderPlacedDate || b.latestDateForOrder || '';
          break;
        case 'start':
          valA = a.startOnSiteDate || '';
          valB = b.startOnSiteDate || '';
          break;
        case 'schedule':
          // Sorting by RAG priority
          const getWeight = (item: ProcurementItem) => {
            if (item.orderPlacedDate) return 3;
            const today = startOfDay(new Date());
            const currentTarget = item.actualEnquiryDate ? item.latestDateForOrder : item.targetEnquiryDate;
            if (!currentTarget) return 2;
            const days = differenceInDays(startOfDay(parseISO(currentTarget)), today);
            if (days < 0) return 0;
            if (days <= 14) return 1;
            return 2;
          };
          valA = getWeight(a);
          valB = getWeight(b);
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortOrder]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('reference')}>
              <div className="flex items-center">Ref <SortIcon column="reference" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('trade')}>
              <div className="flex items-center">Trade Discipline <SortIcon column="trade" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('subcontractor')}>
              <div className="flex items-center">Partner <SortIcon column="subcontractor" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('schedule')}>
              <div className="flex items-center">Schedule <SortIcon column="schedule" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('enquiry')}>
              <div className="flex items-center justify-center">Enquiry <SortIcon column="enquiry" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('return')}>
              <div className="flex items-center justify-center">Return <SortIcon column="return" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('order')}>
              <div className="flex items-center justify-center">Order <SortIcon column="order" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('start')}>
              <div className="flex items-center justify-center">Site Start <SortIcon column="start" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
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

  // AUTOMATED RAG STATUS LOGIC
  const rag = useMemo(() => {
    const today = startOfDay(new Date());
    
    if (item.orderPlacedDate) {
      return { color: 'text-green-600', icon: CheckCircle2, label: 'Ordered' };
    }

    if (item.actualEnquiryDate) {
      if (!item.latestDateForOrder) return { color: 'text-slate-400', label: 'Tendering' };
      const target = startOfDay(parseISO(item.latestDateForOrder));
      const daysUntil = differenceInDays(target, today);
      if (daysUntil < 0) return { color: 'text-red-600', icon: AlertTriangle, label: 'Order Overdue' };
      if (daysUntil <= 14) return { color: 'text-amber-600', icon: Clock, label: 'Order Due' };
      return { color: 'text-green-600', icon: CheckCircle2, label: 'Tendering' };
    }

    if (!item.targetEnquiryDate) return { color: 'text-slate-400', label: '---' };
    const target = startOfDay(parseISO(item.targetEnquiryDate));
    const daysUntil = differenceInDays(target, today);
    if (daysUntil < 0) return { color: 'text-red-600', icon: AlertTriangle, label: 'Enquiry Overdue' };
    if (daysUntil <= 14) return { color: 'text-amber-600', icon: Clock, label: 'Enquiry Due' };
    return { color: 'text-green-600', icon: CheckCircle2, label: 'On Track' };
  }, [item.orderPlacedDate, item.actualEnquiryDate, item.targetEnquiryDate, item.latestDateForOrder]);

  const getMilestoneColor = (actual: string | null, target: string | null) => {
    if (!actual || !target) return "text-muted-foreground";
    const dActual = startOfDay(parseISO(actual));
    const dTarget = startOfDay(parseISO(target));
    return isAfter(dActual, dTarget) ? "text-red-600" : "text-green-600";
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'procurement-items', item.id);
      await deleteDoc(docRef);
      toast({ title: 'Removed', description: 'Item deleted.' });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", item.orderPlacedDate && "opacity-75")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
      <TableCell className="font-bold text-sm truncate max-w-[180px]" title={item.trade}>{item.trade}</TableCell>
      <TableCell className="truncate max-w-[150px] text-xs font-semibold">{item.subcontractorName || 'TBC'}</TableCell>
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

            <EditProcurementDialog 
              item={item} 
              projects={projects} 
              subContractors={subContractors} 
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />

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
  );
}