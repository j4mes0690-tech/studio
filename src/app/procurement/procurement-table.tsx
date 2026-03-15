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
import { ClientDate } from '@/components/client-date';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Loader2, Pencil, Calendar, Clock, ShieldCheck } from 'lucide-react';
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
        <TableCell className="font-bold text-sm">
            <div className="flex items-center gap-2">
                <span>{item.trade}</span>
                {item.warrantyRequired && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild><ShieldCheck className="h-3 w-3 text-amber-600" /></TooltipTrigger>
                            <TooltipContent><p>Warranty Required</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </TableCell>
        <TableCell className="truncate max-w-[150px] text-xs font-semibold">{item.subcontractorName || 'TBC'}</TableCell>
        <TableCell>
          <Badge className={cn("capitalize text-[10px] font-bold h-5", currentStatus.color)}>
            {currentStatus.label}
          </Badge>
        </TableCell>
        <TableCell className="text-center font-mono text-[10px]">{item.actualEnquiryDate || item.targetEnquiryDate ? new Date(item.actualEnquiryDate || item.targetEnquiryDate).toLocaleDateString() : '---'}</TableCell>
        <TableCell className="text-center font-mono text-[10px]">{item.tenderReturnDate ? new Date(item.tenderReturnDate).toLocaleDateString() : '---'}</TableCell>
        <TableCell className="text-center font-mono text-[10px]">{item.orderPlacedDate ? new Date(item.orderPlacedDate).toLocaleDateString() : '---'}</TableCell>
        <TableCell className="text-center font-mono text-[10px] font-bold text-primary">{item.startOnSiteDate ? new Date(item.startOnSiteDate).toLocaleDateString() : '---'}</TableCell>
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
                  <TooltipContent><p>Delete Record</p></TooltipContent>
                </Tooltip>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                  <AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Permanently remove the procurement entry for {item.trade}?</AlertDialogDescription></AlertDialogHeader>
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
