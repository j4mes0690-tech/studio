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
import type { Variation, Project, ClientInstruction, Instruction, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Trash2, FileDown, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
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
import { EditVariationDialog } from './edit-variation';

export function VariationTable({ 
  variations, 
  projects,
  clientInstructions,
  siteInstructions,
  allVariations,
  currentUser
}: { 
  variations: Variation[]; 
  projects: Project[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  allVariations: Variation[];
  currentUser: DistributionUser;
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[120px] text-right">Net Value</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variations.map((v) => (
            <VariationTableRow 
              key={v.id} 
              variation={v} 
              projects={projects}
              clientInstructions={clientInstructions}
              siteInstructions={siteInstructions}
              allVariations={allVariations}
              currentUser={currentUser}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VariationTableRow({ 
  variation, 
  projects,
  clientInstructions,
  siteInstructions,
  allVariations,
  currentUser
}: { 
  variation: Variation; 
  projects: Project[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  allVariations: Variation[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === variation.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = variation.status === 'draft';

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

  const handleCommit = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'variations', variation.id);
      updateDoc(docRef, { status: 'pending' })
        .then(() => toast({ title: 'Success', description: 'Variation submitted.' }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { status: 'pending' }
          }));
        });
    });
  };

  const handleReopen = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'variations', variation.id);
      updateDoc(docRef, { status: 'draft' })
        .then(() => toast({ title: 'Success', description: 'Variation reopened for editing.' }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { status: 'draft' }
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
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'variations', variation.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Variation deleted.' }))
        .catch((err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete'
          }));
        });
    });
  };

  return (
    <>
      <TableRow 
        className={cn("group cursor-pointer", variation.status === 'draft' && "bg-orange-50/20")}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <TableCell className="font-mono text-[10px]">{variation.reference}</TableCell>
        <TableCell className="font-medium truncate max-w-[250px]">{variation.title}</TableCell>
        <TableCell className="truncate max-w-[150px] text-muted-foreground text-xs">{project?.name || 'Unknown'}</TableCell>
        <TableCell className={cn(
            "text-right font-bold",
            variation.totalAmount >= 0 ? "text-green-600" : "text-red-600"
        )}>
            {variation.totalAmount < 0 ? '-' : ''}£{Math.abs(variation.totalAmount || 0).toFixed(2)}
        </TableCell>
        <TableCell>
          <Badge className={cn(
            "capitalize text-[10px] font-bold",
            variation.status === 'agreed' ? 'bg-green-100 text-green-800' :
            variation.status === 'rejected' ? 'bg-red-100 text-red-800' :
            variation.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
          )}>
            {variation.status === 'pending' ? 'Submitted' : variation.status}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">
            <ClientDate date={variation.createdAt} format="date" />
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <TooltipProvider>
              {isDraft ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleCommit} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      <span className="sr-only">Commit & Submit Variation</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Commit & Submit Variation</p></TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8" onClick={handleReopen} disabled={isPending}>
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
                    <span className="sr-only">Download PDF</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Download Variation PDF</p></TooltipContent>
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
                  <AlertDialogHeader><AlertDialogTitle>Delete Variation?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this financial record.</AlertDialogDescription></AlertDialogHeader>
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
    </>
  );
}
