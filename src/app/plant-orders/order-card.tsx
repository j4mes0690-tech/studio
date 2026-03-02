
'use client';

import { useState, useTransition } from 'react';
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
  PowerOff
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EditPlantOrderDialog } from './edit-order';

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

  const isOffHired = order.status === 'off-hired';
  const isOnHire = order.status === 'on-hire';

  const handleToggleHire = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'plant-orders', order.id);
        const newStatus = isOnHire ? 'off-hired' : 'on-hire';
        const updates: any = { status: newStatus };
        if (newStatus === 'off-hired') updates.actualOffHireDate = new Date().toISOString();
        await updateDoc(docRef, updates);
        toast({ title: 'Status Updated', description: `Order is now ${newStatus}.` });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
      }
    });
  };

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
          </div>
          <div>
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Project Allocation</p>
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${project?.name || 'Project'}</p>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
          <h2 style="margin: 0 0 20px 0; font-size: 12px; color: #336AB6; text-transform: uppercase; letter-spacing: 1px;">Hire Period & Commercials</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <p style="margin: 0; font-size: 10px; color: #64748b; text-transform: uppercase;">On-Hire Date</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">${new Date(order.onHireDate).toLocaleString()}</p>
            </div>
            <div>
                <p style="margin: 0; font-size: 10px; color: #64748b; text-transform: uppercase;">Anticipated Off-Hire</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">${new Date(order.anticipatedOffHireDate).toLocaleString()}</p>
            </div>
            <div>
                <p style="margin: 0; font-size: 10px; color: #64748b; text-transform: uppercase;">Actual Off-Hire</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #dc2626;">${order.actualOffHireDate ? new Date(order.actualOffHireDate).toLocaleString() : 'HIRE ACTIVE'}</p>
            </div>
            <div>
                <p style="margin: 0; font-size: 10px; color: #64748b; text-transform: uppercase;">Agreed Rate</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">£${order.rate.toFixed(2)} / ${order.rateUnit}</p>
            </div>
          </div>
        </div>

        ${order.notes ? `
          <div style="margin-bottom: 40px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Special Instructions</p>
            <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.6;">${order.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <p style="font-size: 10px; color: #94a3b8;">Record Created: ${new Date(order.createdAt).toLocaleString()}</p>
          <p style="font-size: 10px; color: #94a3b8;">Printed by: ${currentUser.name}</p>
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

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          isOffHired ? "border-l-muted opacity-75" : isOnHire ? "border-l-green-500 bg-green-50/5" : "border-l-primary"
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn("h-8 w-8", isOnHire ? "text-destructive" : "text-green-600")}
                      onClick={handleToggleHire}
                      disabled={isPending}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isOnHire ? <PowerOff className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{isOnHire ? 'Off-Hire Equipment' : 'Set to On-Hire'}</p></TooltipContent>
                </Tooltip>
                
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
                <div className="space-y-1">
                    <p className="font-bold text-muted-foreground uppercase tracking-widest">On-Hire</p>
                    <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={order.onHireDate} format="date" /></p>
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-muted-foreground uppercase tracking-widest">Expected Off</p>
                    <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={order.anticipatedOffHireDate} format="date" /></p>
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-muted-foreground uppercase tracking-widest">Actual Off</p>
                    <p className={cn("font-medium", order.actualOffHireDate ? "text-foreground" : "text-muted-foreground italic")}>
                        {order.actualOffHireDate ? <ClientDate date={order.actualOffHireDate} format="date" /> : 'Active'}
                    </p>
                </div>
                <div className="space-y-1 text-right">
                    <p className="font-bold text-muted-foreground uppercase tracking-widest">Rate</p>
                    <p className="font-bold text-primary flex items-center justify-end gap-1"><PoundSterling className="h-3 w-3" />{order.rate.toFixed(2)} / {order.rateUnit[0]}</p>
                </div>
            </div>
            {order.notes && <p className="text-xs text-muted-foreground line-clamp-1 italic">"{order.notes}"</p>}
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
