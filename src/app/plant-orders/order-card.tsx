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
  AlertTriangle,
  ShoppingCart,
  Tag,
  MapPin
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { EditPlantOrderDialog } from './edit-order';
import { ImageLightbox } from '@/components/image-lightbox';
import { generatePlantOrderPDF } from '@/lib/pdf-utils';

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

  const itemSummary = useMemo(() => ({
    total: order.items?.length || 0,
    active: order.items?.filter(i => i.status !== 'off-hired').length || 0
  }), [order.items]);

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
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
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
        
        toast({ title: 'Order Activated', description: 'Downloading hire contract PDF...' });
        
        // Trigger automatic download
        await downloadPDF({ ...order, ...updates });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to activate order.', variant: 'destructive' });
      }
    });
  };

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
              <CardDescription className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-foreground uppercase tracking-tight text-[10px] bg-muted px-1.5 rounded flex items-center gap-1">
                    <HardHat className="h-2 w-2" /> {order.supplierName}
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" /> {project?.name || 'Unknown'}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                {isDraft ? (
                  <>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">DRAFT</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-50" onClick={handleCommit} disabled={isPending || isGenerating}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => downloadPDF(order)} disabled={isGenerating}>
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
