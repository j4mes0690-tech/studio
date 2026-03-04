'use client';

import { useState, useTransition, useMemo } from 'react';
import type { PlantOrder, Project, SubContractor, DistributionUser, Photo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Loader2, 
  FileDown,
  Clock,
  HardHat,
  ChevronDown,
  Calculator,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { EditPlantOrderDialog } from './edit-order';
import { ImageLightbox } from '@/components/image-lightbox';

export function OrderCard({ 
  order, 
  project, 
  subContractors,
  projects,
  allOrders,
  currentUser
}: { 
  order: PlantOrder; 
  project?: Project; 
  subContractors: SubContractor[];
  projects: Project[];
  allOrders: PlantOrder[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

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
    if (isDraft || order.status === 'off-hired' || !latestAnticipatedOffHire) {
      return { color: 'text-muted-foreground', label: 'Neutral' };
    }

    const today = startOfDay(new Date());
    const target = startOfDay(parseISO(latestAnticipatedOffHire));
    const daysUntil = differenceInDays(target, today);

    if (daysUntil < 0) {
      return { color: 'text-destructive', label: 'Overdue', icon: AlertTriangle };
    }
    if (daysUntil <= 7) {
      return { color: 'text-amber-600', label: 'Expiring Soon', icon: Clock };
    }
    return { color: 'text-green-600', label: 'Active', icon: CheckCircle2 };
  }, [latestAnticipatedOffHire, order.status, isDraft]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'plant-orders', order.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Success', description: 'Order removed from log.' });
      })
      .catch((error) => {
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
        toast({ title: 'Order Activated', description: 'Hire is now active in the system.' });
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
            <h1 style="margin: 0; color: #336AB6; font-size: 28px; letter-spacing: -1px;">PLANT HIRE SUMMARY</h1>
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

        ${order.notes ? `<div style="margin-bottom: 40px;"><p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Notes</p><p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">${order.notes}</p></div>` : ''}

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

  const itemSummary = useMemo(() => {
    const total = order.items?.length || 0;
    return { total };
  }, [order.items]);

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          isDraft ? "border-orange-200 border-l-orange-400 bg-orange-50/5" :
          order.status === 'off-hired' ? "border-l-muted opacity-75" : 
          (order.status === 'on-hire' || order.status === 'scheduled') ? "border-l-green-500 bg-green-50/5" : "border-l-primary"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "font-mono text-[10px] bg-background",
                  isDraft ? "border-orange-200 text-orange-600" : "text-primary border-primary/20"
                )}>{order.reference}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{order.description}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3">
                <span className="font-bold text-foreground uppercase tracking-tight text-[10px] bg-muted px-1.5 rounded flex items-center gap-1">
                    <HardHat className="h-2 w-2" /> {order.supplierName}
                </span>
                <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                {isDraft ? (
                  <>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">DRAFT</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-50" onClick={handleCommit} disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="sr-only">Activate Order</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Activate Order</p></TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <Badge className={cn(
                      "capitalize text-[10px] font-bold",
                      (order.status === 'on-hire' || order.status === 'scheduled') ? 'bg-green-100 text-green-800' : 
                      order.status === 'off-hired' ? 'bg-muted text-muted-foreground' : 'bg-indigo-600 text-white'
                  )}>
                    {(order.status === 'scheduled' || order.status === 'on-hire') ? 'Active' : order.status}
                  </Badge>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDF} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      <span className="sr-only">Export Hire Record</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Export Hire Record</p></TooltipContent>
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
                    <TooltipContent><p>Delete Order</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This will remove order history for {order.reference}.</AlertDialogDescription></AlertDialogHeader>
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
        <CardContent className="pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed">
                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {order.status === 'off-hired' ? 'Actual Off-Hire' : 'Anticipated Off-Hire'}
                    </p>
                    <p className={cn("text-sm font-bold flex items-center gap-2", ragStatus.color)}>
                        {ragStatus.icon && <ragStatus.icon className="h-4 w-4" />}
                        {(order.status === 'off-hired' ? latestActualOffHire : latestAnticipatedOffHire) ? (
                          new Date((order.status === 'off-hired' ? latestActualOffHire : latestAnticipatedOffHire)!).toLocaleDateString()
                        ) : 'Not defined'}
                    </p>
                    {!isDraft && order.status !== 'off-hired' && (
                      <p className="text-[9px] uppercase font-bold text-muted-foreground/60">{ragStatus.label}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Est. Total Cost</p>
                    <p className="text-xl font-bold text-primary">£{order.totalAmount?.toFixed(2) || '0.00'}</p>
                </div>
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground h-8">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                  {isExpanded ? "Hide Hire Details" : `View ${itemSummary.total} Individual Item Hires`}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-2 rounded border text-[11px] bg-background">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className={cn("font-bold text-primary truncate", item.status === 'off-hired' && "text-muted-foreground")}>{item.description}</p>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" /> {item.onHireDate} &rarr; {item.status === 'off-hired' ? `Off-Hired: ${item.actualOffHireDate}` : item.anticipatedOffHireDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">£{item.estimatedCost?.toFixed(2) || '0.00'}</p>
                        <p className="text-[9px] text-muted-foreground italic">£{item.rate.toFixed(2)} / {item.rateUnit[0]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2 mt-2">
                <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Order Placed: <ClientDate date={order.createdAt} format="date" /></span>
                </div>
                <div className="flex items-center gap-1">
                    <span>By: {order.createdByEmail}</span>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditPlantOrderDialog 
        order={order} 
        projects={projects} 
        subContractors={subContractors} 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
