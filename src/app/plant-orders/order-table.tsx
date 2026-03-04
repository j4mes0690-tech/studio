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
import type { PlantOrder, Project, SubContractor, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useMemo, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, 
  Loader2, 
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
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
import { EditPlantOrderDialog } from './edit-order';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export function OrderTable({ 
  orders, 
  projects, 
  subContractors,
  currentUser
}: { 
  orders: PlantOrder[]; 
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
            <TableHead>Description</TableHead>
            <TableHead className="w-[120px]">Supplier</TableHead>
            <TableHead className="w-[100px] text-right">Cost</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
            <TableHead className="w-[130px]">Off-Hire Due</TableHead>
            <TableHead className="w-[120px]">Order Placed</TableHead>
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
              currentUser={currentUser}
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
  subContractors,
  currentUser
}: { 
  order: PlantOrder; 
  projects: Project[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === order.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = order.status === 'draft';

  const latestAnticipatedOffHire = useMemo(() => {
    if (!order.items || order.items.length === 0) return null;
    return order.items.reduce((latest, item) => {
      if (!item.anticipatedOffHireDate) return latest;
      return !latest || item.anticipatedOffHireDate > latest ? item.anticipatedOffHireDate : latest;
    }, null as string | null);
  }, [order.items]);

  const ragStatus = useMemo(() => {
    if (isDraft || order.status === 'off-hired' || !latestAnticipatedOffHire) return null;
    const today = startOfDay(new Date());
    const target = startOfDay(parseISO(latestAnticipatedOffHire));
    const daysUntil = differenceInDays(target, today);
    if (daysUntil < 0) return { color: 'text-destructive', icon: AlertTriangle };
    if (daysUntil <= 7) return { color: 'text-amber-600', icon: Clock };
    return { color: 'text-green-600', icon: CheckCircle2 };
  }, [latestAnticipatedOffHire, order.status, isDraft]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'plant-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order deleted.' });
    });
  };

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'plant-orders', order.id);
        await updateDoc(docRef, { status: 'scheduled' });
        toast({ title: 'Success', description: 'Order Committed.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to commit order.', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <TableRow 
        className={cn("group cursor-pointer", order.status === 'off-hired' && "opacity-60", isDraft && "bg-orange-50/20")}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <TableCell className="font-mono text-[10px]">{order.reference}</TableCell>
        <TableCell className="font-medium truncate max-w-[180px]">{order.description}</TableCell>
        <TableCell className="truncate max-w-[120px] text-xs font-semibold">{order.supplierName}</TableCell>
        <TableCell className="text-right font-bold">£{order.totalAmount?.toFixed(2) || '0.00'}</TableCell>
        <TableCell>
          <Badge className={cn(
            "capitalize text-[10px] font-bold",
            isDraft ? "bg-orange-100 text-orange-800 border-orange-200" :
            order.status === 'on-hire' ? "bg-green-100 text-green-800" : 
            order.status === 'off-hired' ? "bg-muted text-muted-foreground" : "bg-indigo-600 text-white"
          )}>
            {order.status === 'scheduled' ? 'Committed' : order.status}
          </Badge>
        </TableCell>
        <TableCell>
          {latestAnticipatedOffHire ? (
            <div className={cn("flex items-center gap-1.5 text-xs font-bold", ragStatus?.color)}>
              {ragStatus?.icon && <ragStatus.icon className="h-3 w-3" />}
              {new Date(latestAnticipatedOffHire).toLocaleDateString()}
            </div>
          ) : <span className="text-xs text-muted-foreground italic">N/A</span>}
        </TableCell>
        <TableCell><span className="text-xs text-muted-foreground"><ClientDate date={order.createdAt} format="date" /></span></TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <TooltipProvider>
              {isDraft && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span className="sr-only">Place Order</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Place Order</p></TooltipContent>
                </Tooltip>
              )}

              <AlertDialog>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Order</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                  <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>Permanently remove this plant hire record.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>

      <EditPlantOrderDialog 
        order={order} 
        projects={projects} 
        subContractors={subContractors} 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
