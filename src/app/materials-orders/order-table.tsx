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
  const supplier = suppliers.find(s => s.id === order.supplierId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
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

      reportElement.innerHTML = `
        <div style="border-bottom: 3px solid #336AB6; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; color: #336AB6; font-size: 28px; letter-spacing: -1px;">PURCHASE ORDER</h1>
            <p style="margin: 5px 0 0 0; color: #1e293b; font-size: 18px; font-weight: bold;">${order.description}</p>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Ref: ${order.orderNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Generated via SiteCommand</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px;">
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Supplier Information</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold;">${order.supplierName}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">${supplier?.email || ''}</p>
          </div>
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Project Details</p>
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${project?.name || 'Project'}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Order Date:</strong> ${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #336AB6;">
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">Description</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 60px;">Qty</th>
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; width: 60px;">Unit</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 90px;">Rate</th>
              <th style="padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; color: #64748b; width: 100px;">Delivery</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 100px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 12px; font-weight: 500;">${item.description}</td>
                <td style="padding: 12px; text-align: right; font-size: 12px;">${item.quantity}</td>
                <td style="padding: 12px; text-align: left; font-size: 12px; color: #64748b;">${item.unit}</td>
                <td style="padding: 12px; text-align: right; font-size: 12px;">£${item.rate.toFixed(2)}</td>
                <td style="padding: 12px; text-align: center; font-size: 11px; color: #475569;">${item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'ASAP'}</td>
                <td style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold;">£${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc;">
              <td colspan="5" style="padding: 15px; text-align: right; font-size: 14px; font-weight: bold; color: #336AB6;">ORDER TOTAL (GBP)</td>
              <td style="padding: 15px; text-align: right; font-size: 18px; font-weight: bold; color: #336AB6; border-top: 2px solid #336AB6;">£${order.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="6" style="padding: 10px 15px; text-align: right; font-size: 10px; color: #64748b; font-style: italic;">* All costs exclude VAT</td>
            </tr>
          </tfoot>
        </table>

        ${order.notes ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 40px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e; text-transform: uppercase; font-size: 9px; letter-spacing: 1px;">Special Instructions</p>
            <p style="margin: 0; font-size: 12px; color: #78350f; line-height: 1.6; white-space: pre-wrap;">${order.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <p style="font-size: 10px; color: #94a3b8;">Issued by: ${order.createdByEmail}</p>
          <p style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString()}</p>
        </div>
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`PO-${order.orderNumber}-${order.supplierName.replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'PDF Ready', description: 'Your detailed purchase order has been generated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF form.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
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
                    <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span className="sr-only">Commit Order</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Commit Order</p></TooltipContent>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
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
