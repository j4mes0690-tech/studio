'use client';

import { useState } from 'react';
import type { PurchaseOrder, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Loader2, 
  FileDown,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EditOrderDialog } from './edit-order';

export function OrderCard({ 
  order, 
  project, 
  supplier,
  projects,
  suppliers,
  allOrders,
  currentUser
}: { 
  order: PurchaseOrder; 
  project?: Project; 
  supplier?: SubContractor;
  projects: Project[];
  suppliers: SubContractor[];
  allOrders: PurchaseOrder[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = order.status === 'draft';

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'purchase-orders', order.id);
        await updateDoc(docRef, { 
          status: 'issued',
          orderDate: new Date().toISOString() 
        });
        toast({ title: 'Success', description: 'Purchase order committed.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to commit order.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'purchase-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order removed from log.' });
    });
  };

  const generatePDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
            <p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</p>
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
      toast({ title: 'PDF Ready', description: 'Your detailed purchase order has been generated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF form.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer",
          isDraft && "border-orange-200 bg-orange-50/10"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "font-mono text-[10px] bg-background text-primary border-primary/20",
                  isDraft && "border-orange-200 text-orange-600"
                )}>{order.orderNumber}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{order.description}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3">
                <span className="font-bold text-foreground uppercase tracking-tighter text-[10px] bg-muted px-1.5 rounded">{order.supplierName}</span>
                <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
                {!isDraft && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={order.orderDate} format="date" /></span>
                  </>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                {isDraft ? (
                  <>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">DRAFT</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-orange-600 hover:bg-orange-50"
                          onClick={handleCommit}
                          disabled={isPending}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="sr-only">Commit Order</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Commit Order</p></TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <Badge className={cn(
                    "capitalize text-[10px]",
                    order.status === 'issued' ? 'bg-green-100 text-green-800' : 'bg-muted'
                  )}>{order.status}</Badge>
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
                      <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 bg-muted/20 p-3 rounded-lg border border-dashed">
              <div className="space-y-1 w-full sm:w-auto">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Summary</p>
                <p className="text-sm font-medium">{order.items.length} line items defined</p>
                <div className="flex gap-1 flex-wrap">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[9px] font-normal">{item.description}</Badge>
                  ))}
                  {order.items.length > 3 && <Badge variant="secondary" className="text-[9px] font-normal">+{order.items.length - 3} more</Badge>}
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-primary">£{order.totalAmount.toFixed(2)}</p>
              </div>
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                  {isExpanded ? "Hide Line Details" : "View Detailed Line Items"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-2 rounded border text-[11px] bg-muted/5">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-primary truncate">{item.description}</p>
                        <p className="text-muted-foreground">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">£{item.total.toFixed(2)}</p>
                        <p className={cn(
                          "text-[9px] font-semibold",
                          item.deliveryDate ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {item.deliveryDate ? `Due: ${new Date(item.deliveryDate).toLocaleDateString()}` : 'ASAP'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

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
