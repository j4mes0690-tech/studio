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
            <TableHead className="w-[130px]">Off-Hire Date</TableHead>
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
    const docRef = doc(db, 'plant-orders', order.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Success', description: 'Order removed from log.' });
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        }));
      });
  };

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'plant-orders', order.id);
        await updateDoc(docRef, { status: 'scheduled' });
        toast({ title: 'Success', description: 'Order Activated.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to activate order.', variant: 'destructive' });
      }
    });
  };

  const generatePDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const reportElement = document.createElement('div');
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
      reportElement.style.padding = '50px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      const supplier = subContractors.find(s => s.id === order.supplierId);

      reportElement.innerHTML = `
        <div style="border-bottom: 3px solid #336AB6; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; color: #336AB6; font-size: 28px; letter-spacing: -1px;">PLANT HIRE RECORD</h1>
            <p style="margin: 5px 0 0 0; color: #1e293b; font-size: 18px; font-weight: bold;">${order.description}</p>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Ref: ${order.reference}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Generated via SiteCommand</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px;">
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Supplier Details</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold;">${order.supplierName}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">${supplier?.email || ''}</p>
            ${supplier?.phone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">Tel: ${supplier.phone}</p>` : ''}
            ${supplier?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569; white-space: pre-wrap;">${supplier.address}</p>` : ''}
          </div>
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Project Allocation</p>
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${project?.name || 'Project'}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #336AB6;">
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">Description</th>
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">On-Hire</th>
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">Off-Hire</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b;">Rate</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b;">Est. Cost</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 12px; font-weight: bold;">${item.description}</td>
                <td style="padding: 12px; font-size: 11px;">${item.onHireDate}</td>
                <td style="padding: 12px; font-size: 11px;">${item.status === 'off-hired' ? (item.actualOffHireDate || '---') : item.anticipatedOffHireDate}</td>
                <td style="padding: 12px; font-size: 11px; text-align: right;">£${item.rate.toFixed(2)} / ${item.rateUnit === 'item' ? 'ea' : item.rateUnit[0]}</td>
                <td style="padding: 12px; font-size: 11px; text-align: right; font-weight: bold;">£${item.estimatedCost?.toFixed(2) || '0.00'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc;">
              <td colspan="4" style="padding: 15px; text-align: right; font-size: 14px; font-weight: bold; color: #336AB6;">ESTIMATED TOTAL (GBP)</td>
              <td style="padding: 15px; text-align: right; font-size: 18px; font-weight: bold; color: #336AB6; border-top: 2px solid #336AB6;">£${order.totalAmount?.toFixed(2) || '0.00'}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <p style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString()}</p>
          <p style="font-size: 10px; color: #94a3b8;">Issued by: ${order.createdByEmail}</p>
        </div>
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`PLANT-${order.reference}.pdf`);
      toast({ title: 'PDF Ready', description: 'Plant hire record exported.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const offHireDisplayDate = order.status === 'off-hired' ? latestActualOffHire : latestAnticipatedOffHire;

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
                    <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span className="sr-only">Activate Order</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Activate Order</p></TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDF} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    <span className="sr-only">Download PDF</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Download PO as PDF</p></TooltipContent>
              </Tooltip>

              <AlertDialog>
                <TooltipProvider>
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
