
'use client';

import { useState } from 'react';
import type { PurchaseOrder, Project, Supplier, Photo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Trash2, 
  ChevronRight, 
  Calendar, 
  Truck, 
  User, 
  Download, 
  Loader2, 
  AlertTriangle,
  FileDown
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';

export function OrderCard({ order, project, supplier }: { order: PurchaseOrder; project?: Project; supplier?: Supplier }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'purchase-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order removed from log.' });
    });
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const reportElement = document.createElement('div');
      reportElement.style.padding = '50px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      reportElement.innerHTML = `
        <div style="border-bottom: 3px solid #336AB6; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; color: #336AB6; font-size: 32px; letter-spacing: -1px;">PURCHASE ORDER</h1>
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
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569; line-height: 1.5;">${supplier?.address || 'Address on file'}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">${supplier?.email || ''}</p>
          </div>
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Delivery Details</p>
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${project?.name || 'Project'}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Req. Delivery:</strong> ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'ASAP'}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #336AB6;">
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">Description</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 100px;">Qty</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 120px;">Unit Price</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 120px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 13px; font-weight: 500;">${item.materialName}</td>
                <td style="padding: 12px; text-align: right; font-size: 13px;">${item.quantity}</td>
                <td style="padding: 12px; text-align: right; font-size: 13px;">$${item.unitPrice.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; font-size: 13px; font-weight: bold;">$${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc;">
              <td colspan="3" style="padding: 15px; text-align: right; font-size: 14px; font-weight: bold; color: #336AB6;">ORDER TOTAL (USD)</td>
              <td style="padding: 15px; text-align: right; font-size: 18px; font-weight: bold; color: #336AB6; border-top: 2px solid #336AB6;">$${order.totalAmount.toFixed(2)}</td>
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
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`PO-${order.orderNumber}-${order.supplierName.replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'PDF Ready', description: 'Your purchase order has been generated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF form.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors shadow-sm group">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/20">{order.orderNumber}</Badge>
              <CardTitle className="text-lg">{order.supplierName}</CardTitle>
            </div>
            <CardDescription className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={order.orderDate} format="date" /></span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(
              "capitalize text-[10px]",
              order.status === 'issued' ? 'bg-green-100 text-green-800' : 'bg-muted'
            )}>{order.status}</Badge>
            
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDF} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove order {order.orderNumber} from the system history. This action is permanent.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mt-2 bg-muted/20 p-3 rounded-lg border border-dashed">
          <div className="space-y-1 w-full sm:w-auto">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Summary</p>
            <p className="text-sm font-medium">{order.items.length} materials requested</p>
            <div className="flex gap-1 flex-wrap">
              {order.items.slice(0, 3).map((item, idx) => (
                <Badge key={idx} variant="secondary" className="text-[9px] font-normal">{item.materialName}</Badge>
              ))}
              {order.items.length > 3 && <Badge variant="secondary" className="text-[9px] font-normal">+{order.items.length - 3} more</Badge>}
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-primary">${order.totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
