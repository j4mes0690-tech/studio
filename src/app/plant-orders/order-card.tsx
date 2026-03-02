'use client';

import { useState, useTransition, useMemo } from 'react';
import type { PlantOrder, Project, SubContractor, DistributionUser } from '@/lib/types';
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
  PoundSterling,
  Power,
  PowerOff,
  ChevronDown
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EditPlantOrderDialog } from './edit-order';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'plant-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Order removed.' });
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
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 12px; font-weight: bold;">${item.description}</td>
                <td style="padding: 12px; font-size: 11px;">${item.onHireDate}</td>
                <td style="padding: 12px; font-size: 11px;">${item.actualOffHireDate || item.anticipatedOffHireDate}</td>
                <td style="padding: 12px; font-size: 11px; text-align: right;">£${item.rate.toFixed(2)} / ${item.rateUnit[0]}</td>
                <td style="padding: 12px; font-size: 10px; text-align: right; text-transform: uppercase; font-weight: bold;">${item.status}</td>
              </tr>
            `).join('')}
          </tbody>
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
    const active = order.items?.filter(i => i.status === 'on-hire').length || 0;
    return { total, active };
  }, [order.items]);

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          order.status === 'off-hired' ? "border-l-muted opacity-75" : order.status === 'on-hire' ? "border-l-green-500 bg-green-50/5" : "border-l-primary"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/20">{order.reference}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{order.description}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3">
                <span className="font-bold text-foreground uppercase tracking-tight text-[10px] bg-muted px-1.5 rounded flex items-center gap-1">
                    <HardHat className="h-2.5 w-2.5" /> {order.supplierName}
                </span>
                <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                <Badge className={cn(
                    "capitalize text-[10px]",
                    order.status === 'on-hire' ? 'bg-green-100 text-green-800' : 
                    order.status === 'off-hired' ? 'bg-muted' : 'bg-primary/10 text-primary'
                )}>{order.status}</Badge>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDF} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
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
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
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
                    <p className="text-sm font-medium">{itemSummary.total} plant items included</p>
                    <div className="flex gap-1 flex-wrap">
                        {order.items?.slice(0, 3).map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[9px] font-normal">{item.description}</Badge>
                        ))}
                        {itemSummary.total > 3 && <Badge variant="secondary" className="text-[9px] font-normal">+{itemSummary.total - 3} more</Badge>}
                    </div>
                </div>
                <div className="text-right">
                    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", itemSummary.active > 0 ? "text-green-600 bg-green-50" : "text-muted-foreground")}>
                        {itemSummary.active} Items On-Hire
                    </Badge>
                </div>
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                  {isExpanded ? "Hide Line Details" : "View Individual Item Hires"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-2 rounded border text-[11px] bg-muted/5">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-primary truncate">{item.description}</p>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" /> {item.onHireDate} &rarr; {item.actualOffHireDate || item.anticipatedOffHireDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">£{item.rate.toFixed(2)} / {item.rateUnit[0]}</p>
                        <Badge variant="outline" className={cn(
                            "text-[8px] h-4 leading-none",
                            item.status === 'on-hire' ? "text-green-600 border-green-200" : "text-muted-foreground"
                        )}>{item.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
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
    </>
  );
}
