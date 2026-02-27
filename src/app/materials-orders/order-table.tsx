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
import type { PurchaseOrder, Project, SubContractor, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  FileDown 
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
import { EditOrderDialog } from './edit-order';

export function OrderTable({ 
  orders, 
  projects, 
  suppliers,
  allOrders,
  currentUser
}: { 
  orders: PurchaseOrder[]; 
  projects: Project[]; 
  suppliers: SubContractor[];
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Order Ref</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[150px]">Supplier</TableHead>
            <TableHead className="w-[100px] text-right">Amount</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderTableRow 
              key={order.id} 
              order={order} 
              projects={projects} 
              suppliers={suppliers} 
              allOrders={allOrders}
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
  suppliers,
  allOrders,
  currentUser
}: { 
  order: PurchaseOrder; 
  projects: Project[]; 
  suppliers: SubContractor[];
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === order.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = order.status === 'draft';

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'purchase-orders', order.id);
      await updateDoc(docRef, { 
        status: 'issued',
        orderDate: new Date().toISOString()
      });
      toast({ title: 'Success', description: 'Order committed.' });
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'purchase-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order deleted.' });
    });
  };

  return (
    <>
      <TableRow 
        className={cn("group cursor-pointer", isDraft && "bg-orange-50/20")}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <TableCell className="font-mono text-[10px]">{order.orderNumber}</TableCell>
        <TableCell className="font-medium truncate max-w-[250px]">{order.description}</TableCell>
        <TableCell className="truncate max-w-[150px] text-muted-foreground text-xs">{project?.name || 'Unknown'}</TableCell>
        <TableCell className="truncate max-w-[150px] text-xs">{order.supplierName}</TableCell>
        <TableCell className="text-right font-bold">£{order.totalAmount.toFixed(2)}</TableCell>
        <TableCell>
          {isDraft ? (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">DRAFT</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">ISSUED</Badge>
          )}
        </TableCell>
        <TableCell>
          {!isDraft ? (
            <span className="text-xs text-muted-foreground">
              <ClientDate date={order.orderDate} format="date" />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Pending</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <TooltipProvider>
              {isDraft && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-orange-600" onClick={handleCommit} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span className="sr-only">Commit Order</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Commit Order</p></TooltipContent>
                </Tooltip>
              )}
              
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Order</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Order</p></TooltipContent>
                </Tooltip>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                    <AlertDialogDescription>Permanently remove order {order.orderNumber}.</AlertDialogDescription>
                  </AlertDialogHeader>
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

      <EditOrderDialog 
        order={order} 
        projects={projects} 
        suppliers={suppliers} 
        allOrders={allOrders}
        currentUser={currentUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
