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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { 
  Trash2, 
  Loader2, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Tag,
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
import { EditPlantOrderDialog } from './edit-order';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { generatePlantOrderPDF } from '@/lib/pdf-utils';

type SortKey = 'reference' | 'description' | 'supplier' | 'amount' | 'status' | 'offHireDate' | 'date';
type SortOrder = 'asc' | 'desc';

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
        case 'reference':
          valA = a.reference;
          valB = b.reference;
          break;
        case 'description':
          valA = a.description;
          valB = b.description;
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
        case 'offHireDate':
          const offA = a.items?.reduce((max, i) => i.anticipatedOffHireDate > max ? i.anticipatedOffHireDate : max, '') || '';
          const offB = b.items?.reduce((max, i) => i.anticipatedOffHireDate > max ? i.anticipatedOffHireDate : max, '') || '';
          valA = offA;
          valB = offB;
          break;
        case 'date':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortKey, sortOrder]);

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
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('description')}>
              <div className="flex items-center">Description <SortIcon column="description" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('supplier')}>
              <div className="flex items-center">Supplier <SortIcon column="supplier" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-right cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('amount')}>
              <div className="flex items-center justify-end">Cost <SortIcon column="amount" /></div>
            </TableHead>
            <TableHead className="w-[130px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
              <div className="flex items-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[130px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('offHireDate')}>
              <div className="flex items-center">Off-Hire <SortIcon column="offHireDate" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
              <div className="flex items-center">Placed <SortIcon column="date" /></div>
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = order.status === 'draft';

  const latestAnticipatedOffHire = useMemo(() => {
    if (!order.items || order.items.length === 0) return null;
    return order.items.reduce((latest, item) => {
      if (!item.anticipatedOffHireDate) return latest;
      return !latest || item.anticipatedOffHireDate > latest ? item.anticipatedOffHireDate : latest;
    }, null as string | null);
  }, [order.items]);

  const latestActualOffHire = useMemo(() => {
    if (!order.items || order.items.length === 0) return null;
    return order.items.reduce((latest, item) => {
      if (!item.actualOffHireDate) return latest;
      return !latest || item.actualOffHireDate > latest ? item.actualOffHireDate : latest;
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
      await deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Success', description: 'Order removed from log.' });
        })
        .catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          }));
        });
    });
  };

  const downloadPDF = async (orderData: PlantOrder) => {
    setIsGenerating(true);
    try {
      const supplier = subContractors.find(s => s.id === orderData.supplierId);
      const pdf = await generatePlantOrderPDF(orderData, project, supplier);
      pdf.save(`PLANT-${orderData.reference}.pdf`);
      toast({ title: 'PDF Ready', description: 'Plant hire record exported.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'plant-orders', order.id);
        const updates = { status: 'scheduled' as const };
        await updateDoc(docRef, updates);
        
        toast({ title: 'Success', description: 'Order Activated. Downloading PDF...' });
        
        // Automatic download
        await downloadPDF({ ...order, ...updates });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to activate order.', variant: 'destructive' });
      }
    });
  };

  const offHireDisplayDate = order.status === 'off-hired' ? latestActualOffHire : latestAnticipatedOffHire;

  return (
    <TableRow 
      className={cn("group cursor-pointer", order.status === 'off-hired' && "opacity-60", isDraft && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">
        <span>{order.reference}</span>
      </TableCell>
      <TableCell className="font-medium truncate max-w-[180px]">{order.description}</TableCell>
      <TableCell className="truncate max-w-[120px] text-xs font-semibold">{order.supplierName}</TableCell>
      <TableCell className="text-right font-bold">£{order.totalAmount?.toFixed(2) || '0.00'}</TableCell>
      <TableCell>
        <Badge className={cn(
          "capitalize text-[10px] font-bold",
          isDraft ? "bg-orange-100 text-orange-800 border-orange-200" :
          (order.status === 'on-hire' || order.status === 'scheduled') ? "bg-green-100 text-green-800" : 
          order.status === 'off-hired' ? "bg-muted text-muted-foreground" : "bg-indigo-600 text-white"
        )}>
          {(order.status === 'scheduled' || order.status === 'on-hire') ? 'Active' : order.status}
        </Badge>
      </TableCell>
      <TableCell>
        {offHireDisplayDate ? (
          <div className={cn("flex items-center gap-1.5 text-xs font-bold", order.status !== 'off-hired' && ragStatus?.color)}>
            {order.status !== 'off-hired' && ragStatus?.icon && <ragStatus.icon className="h-3 w-3" />}
            {new Date(offHireDisplayDate).toLocaleDateString()}
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
                  <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending || isGenerating}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="sr-only">Activate Order</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Activate Order</p></TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => downloadPDF(order)} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  <span className="sr-only">Download PO as PDF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Download PO as PDF</p></TooltipContent>
            </Tooltip>

            <EditPlantOrderDialog 
              order={order} 
              projects={projects} 
              subContractors={subContractors} 
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />

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
                <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>Permanently remove this plant hire record.</AlertDialogDescription></AlertDialogHeader>
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