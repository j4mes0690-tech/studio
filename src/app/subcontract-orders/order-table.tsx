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
import type { SubContractOrder, Project, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { Trash2, Loader2, UserPlus, FileSignature, CheckCircle2, Clock, Send, Pencil } from 'lucide-react';
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
import { EditSubContractOrderDialog } from './edit-order';

export function OrderTable({ 
  orders, 
  projects, 
  subContractors
}: { 
  orders: SubContractOrder[]; 
  projects: Project[]; 
  subContractors: SubContractor[];
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Ref</TableHead>
            <TableHead>Subcontractor</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px] text-center">Drafted</TableHead>
            <TableHead className="w-[100px] text-center">Sent</TableHead>
            <TableHead className="w-[100px] text-center">DocuSign</TableHead>
            <TableHead className="w-[100px] text-center">Signed</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderTableRow 
              key={order.id} 
              order={order} 
              projects={projects} 
              subContractors={subContractors} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderTableRow({ 
  order, 
  projects, 
  subContractors
}: { 
  order: SubContractOrder; 
  projects: Project[]; 
  subContractors: SubContractor[];
}) {
  const project = projects.find(p => p.id === order.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isCompleted = order.status === 'completed';
  const isSubAssignedToProject = project?.assignedSubContractors?.includes(order.subcontractorId);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'subcontract-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Deleted', description: 'Tracking record removed.' });
    });
  };

  const handleAssignToProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project) return;
    startTransition(async () => {
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          assignedSubContractors: arrayUnion(order.subcontractorId)
        });
        toast({ title: 'Team Updated', description: 'Subcontractor assigned to project.' });
      } catch (err) {}
    });
  };

  const statusConfig = {
    'draft': { label: 'Draft', color: 'bg-slate-100 text-slate-800' },
    'pending-approval': { label: 'Sent', color: 'bg-amber-100 text-amber-800' },
    'docusign': { label: 'DocuSign', color: 'bg-blue-100 text-blue-800' },
    'completed': { label: 'Signed', color: 'bg-green-100 text-green-800' },
  };

  const currentStatus = statusConfig[order.status];

  return (
    <TableRow 
      className={cn("group cursor-pointer", isCompleted && "opacity-75", order.status === 'draft' && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">{order.reference}</TableCell>
      <TableCell className="font-bold text-sm truncate max-w-[180px]">{order.subcontractorName}</TableCell>
      <TableCell className="truncate max-w-[150px] text-xs font-semibold">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <Badge className={cn("capitalize text-[10px] font-bold h-5", currentStatus.color)}>
          {currentStatus.label}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-mono text-[10px]">{order.draftedDate ? new Date(order.draftedDate).toLocaleDateString() : '---'}</TableCell>
      <TableCell className="text-center font-mono text-[10px]">{order.sentForApprovalDate ? new Date(order.sentForApprovalDate).toLocaleDateString() : '---'}</TableCell>
      <TableCell className="text-center font-mono text-[10px]">{order.loadedOnDocuSignDate ? new Date(order.loadedOnDocuSignDate).toLocaleDateString() : '---'}</TableCell>
      <TableCell className="text-center font-mono text-[10px] font-bold">{order.signedDate ? new Date(order.signedDate).toLocaleDateString() : '---'}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsEditDialogOpen(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit Order</p></TooltipContent>
            </Tooltip>

            {isCompleted && !isSubAssignedToProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={handleAssignToProject} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Assign to project team</p></TooltipContent>
              </Tooltip>
            )}

            <EditSubContractOrderDialog 
              order={order} 
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
                <TooltipContent><p>Delete Order</p></TooltipContent>
              </Tooltip>
              <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>Permanently remove this agreement history.</AlertDialogDescription></AlertDialogHeader>
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