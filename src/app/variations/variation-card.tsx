'use client';

import { useState, useTransition, useMemo } from 'react';
import type { Variation, Project, ClientInstruction, Instruction, DistributionUser, Photo } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calculator, 
  Loader2, 
  FileDown,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Percent,
  RefreshCw,
  Maximize2
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
import { EditVariationDialog } from './edit-variation';
import { ImageLightbox } from '@/components/image-lightbox';

export function VariationCard({ 
  variation, 
  project, 
  projects,
  clientInstructions = [], 
  siteInstructions = [], 
  allVariations,
  currentUser
}: { 
  variation: Variation; 
  project?: Project; 
  projects: Project[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  allVariations: Variation[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const isDraft = variation.status === 'draft';

  // Link matching for multiple IDs
  const linkedCIs = useMemo(() => 
    (clientInstructions || []).filter(c => (variation.clientInstructionIds || []).includes(c.id)), 
    [clientInstructions, variation.clientInstructionIds]
  );
  
  const linkedSIs = useMemo(() => 
    (siteInstructions || []).filter(s => (variation.siteInstructionIds || []).includes(s.id)), 
    [siteInstructions, variation.siteInstructionIds]
  );

  const grossCost = useMemo(() => {
    return (variation.items || []).reduce((sum, item) => {
      return item.type === 'addition' ? sum + item.total : sum - item.total;
    }, 0);
  }, [variation.items]);

  const ohpAmount = useMemo(() => (grossCost * ((variation.ohpPercentage || 0) / 100)), [grossCost, variation.ohpPercentage]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'variations', variation.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Variation removed.' }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete'
          }));
        });
    });
  };

  const handleUpdateStatus = (newStatus: Variation['status']) => {
    startTransition(async () => {
      const docRef = doc(db, 'variations', variation.id);
      updateDoc(docRef, { status: newStatus })
        .then(() => toast({ title: 'Status Updated', description: `Variation is now ${newStatus}.` }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { status: newStatus }
          }));
        });
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
        <div style="border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 40px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">VARIATION ORDER</h1>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">${variation.title}</p>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Ref: ${variation.reference}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px;">
          <div>
            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Project</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold;">${project?.name || 'Project'}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Status</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold; text-transform: uppercase;">${variation.status}</p>
          </div>
        </div>

        ${linkedCIs.length > 0 || linkedSIs.length > 0 ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 40px;">
            <p style="margin: 0 0 5px 0; font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Source Directives</p>
            ${linkedCIs.map(ci => `<p style="margin: 0; font-size: 12px;"><strong>Client Inst:</strong> ${ci.reference}</p>`).join('')}
            ${linkedSIs.map(si => `<p style="margin: 5px 0 0 0; font-size: 12px;"><strong>Site Inst:</strong> ${si.reference}</p>`).join('')}
          </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #1e40af;">
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase;">Description</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; width: 60px;">Qty</th>
              <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; width: 60px;">Unit</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; width: 100px;">Rate</th>
              <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(variation.items || []).map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 12px;">
                    <span style="color: ${item.type === 'omission' ? '#dc2626' : '#16a34a'}; font-weight: bold;">[${item.type === 'omission' ? '-' : '+'}]</span>
                    ${item.description}
                </td>
                <td style="padding: 12px; text-align: right; font-size: 12px;">${item.quantity}</td>
                <td style="padding: 12px; text-align: left; font-size: 12px; color: #64748b;">${item.unit}</td>
                <td style="padding: 12px; text-align: right; font-size: 12px;">£${item.rate.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold; color: ${item.type === 'omission' ? '#dc2626' : '#16a34a'};">
                    ${item.type === 'omission' ? '-' : ''}£${item.total.toFixed(2)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px; margin-bottom: 40px;">
            <div style="font-size: 12px; color: #64748b;">Subtotal: £${grossCost.toFixed(2)}</div>
            <div style="font-size: 12px; color: #64748b;">OHP (${variation.ohpPercentage}%): £${ohpAmount.toFixed(2)}</div>
            <div style="font-size: 18px; font-weight: bold; color: #1e40af; border-top: 2px solid #1e40af; padding-top: 10px; margin-top: 5px;">
                NET VARIATION TOTAL: £${(variation.totalAmount || 0).toFixed(2)}
            </div>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
          <p style="font-size: 10px; color: #94a3b8;">Issued by: ${variation.createdByEmail}</p>
          <p style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString()}</p>
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
      pdf.save(`VO-${variation.reference}.pdf`);
      toast({ title: 'PDF Ready', description: 'Variation order document generated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate document.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          variation.status === 'agreed' ? "border-l-green-500" :
          variation.status === 'rejected' ? "border-l-destructive" :
          variation.status === 'draft' ? "border-l-orange-400 border-orange-200 bg-orange-50/10" : "border-l-primary"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary">{variation.reference}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{variation.title}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3">
                <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground"><ClientDate date={variation.createdAt} format="date" /></span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <Badge className={cn(
                "capitalize text-[10px] font-bold",
                variation.status === 'agreed' ? 'bg-green-100 text-green-800' :
                variation.status === 'rejected' ? 'bg-red-100 text-red-800' :
                variation.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
              )}>
                {variation.status === 'pending' ? 'Submitted' : variation.status}
              </Badge>
              
              <TooltipProvider>
                {!isDraft && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleUpdateStatus('draft')}
                        disabled={isPending}
                      >
                        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Reopen for Editing</p></TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDF} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download PDF</p></TooltipContent>
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
                    <TooltipContent><p>Delete Variation</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete Variation?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this financial record. Action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
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
            {(linkedCIs.length > 0 || linkedSIs.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                    {linkedCIs.map(ci => <Badge key={ci.id} variant="secondary" className="text-[9px] gap-1 h-5"><LinkIcon className="h-2.5 w-2.5" /> CI: {ci.reference}</Badge>)}
                    {linkedSIs.map(si => <Badge key={si.id} variant="secondary" className="text-[9px] gap-1 h-5"><LinkIcon className="h-2.5 w-2.5" /> SI: {si.reference}</Badge>)}
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-end gap-4 bg-muted/20 p-3 rounded-lg border border-dashed">
              <div className="space-y-1 w-full sm:w-auto">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pricing Model</p>
                <div className="flex flex-col gap-1">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold"><ArrowUpCircle className="h-3 w-3" /> {variation.items.filter(i => i.type === 'addition').length} Add</div>
                        <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold"><ArrowDownCircle className="h-3 w-3" /> {variation.items.filter(i => i.type === 'omission').length} Om</div>
                    </div>
                    {variation.ohpPercentage > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                            <Percent className="h-2.5 w-2.5" /> {variation.ohpPercentage}% OHP included
                        </div>
                    )}
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Final Net Value</p>
                <p className={cn(
                    "text-2xl font-bold",
                    variation.totalAmount >= 0 ? "text-green-600" : "text-red-600"
                )}>
                    {variation.totalAmount < 0 ? '-' : ''}£{Math.abs(variation.totalAmount || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground h-8">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                  {isExpanded ? "Hide Details" : "View Cost Breakdown"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  <div className="p-2 bg-muted/5 border-b text-[10px] font-bold text-muted-foreground uppercase">Base Build</div>
                  {variation.items.map((item, i) => (
                    <div key={item.id} className="flex items-start justify-between p-2 rounded border text-[11px] bg-background">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className={cn("font-bold truncate", item.type === 'addition' ? "text-green-700" : "text-red-700")}>{item.description}</p>
                        <p className="text-muted-foreground">{item.quantity} {item.unit} @ £{item.rate.toFixed(2)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("font-bold", item.type === 'addition' ? "text-green-600" : "text-red-600")}>
                            {item.type === 'omission' ? '-' : ''}£{item.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {variation.ohpPercentage > 0 && (
                    <div className="flex items-center justify-between p-2 rounded border border-primary/20 bg-primary/5 text-[11px]">
                        <span className="font-bold text-primary uppercase">Overhead & Profit ({variation.ohpPercentage}%)</span>
                        <span className="font-bold text-primary">£{ohpAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      <EditVariationDialog 
        variation={variation}
        projects={projects}
        allVariations={allVariations}
        clientInstructions={clientInstructions}
        siteInstructions={siteInstructions}
        currentUser={currentUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
