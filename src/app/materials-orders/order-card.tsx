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
  CheckCircle2,
  Tag
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
import { generatePurchaseOrderPDF } from '@/lib/pdf-utils';

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

  const downloadPDF = async (orderData: PurchaseOrder) => {
    setIsGenerating(true);
    try {
      const pdf = await generatePurchaseOrderPDF(orderData, project, supplier);
      pdf.save(`PO-${orderData.orderNumber}-${orderData.supplierName.replace(/\s+/g, '-')}.pdf`);
      toast({ title: 'PDF Ready', description: 'The purchase order has been downloaded.' });
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
        
        // Trigger automatic download
        await downloadPDF({ ...order, ...updates });
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
                {order.cvrCode && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-[9px] h-4 gap-1 px-1.5 bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-tighter">
                          <Tag className="h-2.5 w-2.5" /> {order.cvrCode}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>Internal CVR Reference</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <CardDescription className="flex items-center gap-3">
                <span className="font-bold text-foreground uppercase tracking-tighter text-[10px] bg-muted px-1.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="h-2 w-2" /> {order.supplierName}
                </span>
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
                          disabled={isPending || isGenerating}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          <span className="sr-only">Commit Order</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Commit & Download PDF</p></TooltipContent>
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={(e) => downloadPDF(order)} disabled={isGenerating}>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
