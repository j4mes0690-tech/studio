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
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  FileDown,
  Tag,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
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
import { generatePurchaseOrderPDF } from '@/lib/pdf-utils';

type SortKey = 'orderNumber' | 'description' | 'project' | 'supplier' | 'amount' | 'status' | 'date';
type SortOrder = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'orderNumber':
          valA = a.orderNumber;
          valB = b.orderNumber;
          break;
        case 'description':
          valA = a.description;
          valB = b.description;
          break;
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'supplier':
          valA = a.supplierName;
          valB = b.supplierName;
          break;
        case 'amount':
          valA = a.totalAmount;
          valB = b.totalAmount;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'date':
          valA = new Date(a.orderDate || a.createdAt).getTime();
          valB = new Date(b.orderDate || b.createdAt).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortKey, sortOrder, projects]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('orderNumber')}>
              <div className="flex items-center">Order Ref <SortIcon column="orderNumber" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('description')}>
              <div className="flex items-center">Description <SortIcon column="description" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('project')}>
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('supplier')}>
              <div className="flex items-center">Supplier <SortIcon column="supplier" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-right cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('amount')}>
              <div className="flex items-center justify-end">Amount <SortIcon column="amount" /></div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
              <div className="flex items-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
              <div className="flex items-center">Date <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => (
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
  const supplier = suppliers.find(s => s.id === order.supplierId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = order.status === 'draft';

  const downloadPDF = async (orderData: PurchaseOrder) => {
    setIsGenerating(true);
    try {
      const pdf = await generatePurchaseOrderPDF(orderData, project, supplier);
      pdf.save(`PO-${orderData.orderNumber}-${orderData.supplierName.replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'PDF Ready', description: 'Purchase order downloaded.' });
    } catch (err) {
      toast({ title: 'PDF Error', description: 'Failed to generate document.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'purchase-orders', order.id);
        const orderDate = new Date().toISOString();
        const updates = { 
          status: 'issued' as const,
          orderDate
        };
        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Order committed. Downloading PDF...' });
        
        // Automatic download
        await downloadPDF({ ...order, ...updates });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to commit order.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'purchase-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order deleted.' });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", isDraft && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">
        <span>{order.orderNumber}</span>
      </TableCell>
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
                  <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending || isGenerating}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="sr-only">Commit Order</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Commit & Download PDF</p></TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => downloadPDF(order)} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  <span className="sr-only">Download PDF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Download PO as PDF</p></TooltipContent>
            </Tooltip>
            
            <div onClick={e => e.stopPropagation()}>
                <EditOrderDialog 
                order={order} 
                projects={projects} 
                suppliers={suppliers} 
                allOrders={allOrders}
                currentUser={currentUser}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                />
            </div>

            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Order</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove order {order.orderNumber} from the system history. This action is permanent.</AlertDialogDescription>
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
  );
}
