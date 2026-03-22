'use client';

import { useState, useTransition, useMemo } from 'react';
import type { Permit, Project, SubContractor, DistributionUser, Photo } from '@/lib/types';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Clock, 
  Loader2, 
  FileDown,
  XCircle,
  HardHat,
  MapPin,
  Calendar,
  Maximize2,
  CheckCircle2,
  ChevronDown,
  Layout,
  Pencil,
  Check,
  Minus,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { EditPermitDialog } from './edit-permit';
import { ImageLightbox } from '@/components/image-lightbox';
import { sendPermitEmailAction } from './actions';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export function PermitCard({ 
  permit, 
  project, 
  subContractor,
  projects,
  subContractors,
  allPermits,
  currentUser
}: { 
  permit: Permit; 
  project?: Project; 
  subContractor?: SubContractor;
  projects: Project[];
  subContractors: SubContractor[];
  allPermits: Permit[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isDraft = permit.status === 'draft';
  const isClosed = permit.status === 'closed';
  const isExpired = !isClosed && new Date(permit.validTo) < new Date();

  const handleIssue = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'permits', permit.id);
        await updateDoc(docRef, { status: 'issued' });
        toast({ title: 'Permit Issued', description: 'Permit is now active on site.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to issue permit.', variant: 'destructive' });
      }
    });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'permits', permit.id);
        await updateDoc(docRef, { 
          status: 'closed',
          closedAt: new Date().toISOString(),
          closedByEmail: currentUser.email
        });
        toast({ title: 'Permit Closed', description: 'Work signed off.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to close permit.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'permits', permit.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Permit record deleted.' });
    });
  };

  const generatePDFAndEmail = async (e: React.MouseEvent) => {
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

      const areaName = permit.customAreaName || project?.areas?.find(a => a.id === permit.areaId)?.name || 'General Site';

      let sectionsHtml = '';
      (permit.sections || []).forEach(section => {
        let fieldsHtml = '';
        section.fields.forEach(f => {
          let valueDisplay = String(f.value || '---');
          if (f.type === 'checkbox') valueDisplay = f.value ? 'YES' : 'NO';
          if (f.type === 'yes-no-na') valueDisplay = String(f.value || '---').toUpperCase();
          if (f.type === 'photo' && Array.isArray(f.value)) valueDisplay = `[${f.value.length} Photo(s) Captured]`;

          fieldsHtml += `
            <div style="display: flex; align-items: flex-start; gap: 10px; border: 1px solid #f1f5f9; padding: 8px; border-radius: 4px;">
              <div style="flex: 1;">
                <p style="margin: 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">${f.label}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: bold;">${valueDisplay}</p>
              </div>
            </div>
          `;
        });

        sectionsHtml += `
          <div style="margin-bottom: 30px;">
            <h3 style="font-size: 12px; color: #334155; background: #f1f5f9; padding: 8px; margin-bottom: 15px; font-weight: bold; text-transform: uppercase;">${section.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              ${fieldsHtml}
            </div>
          </div>
        `;
      });

      reportElement.innerHTML = `
        <div style="border: 4px solid #1e40af; padding: 30px; border-radius: 8px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">PERMIT TO WORK</h1>
          <p style="margin: 5px 0 30px 0; font-weight: bold; color: #dc2626;">Ref: ${permit.reference}</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Instructed Party</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${permit.contractorName}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Project / Location</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${project?.name || 'Project'} - ${areaName}</p>
            </div>
          </div>

          ${sectionsHtml}

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
            <p style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString()}</p>
          </div>
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

      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      
      if (subContractor?.email) {
        await sendPermitEmailAction({
          email: subContractor.email,
          name: subContractor.name,
          projectName: project?.name || 'Project',
          permitRef: permit.reference,
          permitType: permit.type,
          pdfBase64,
          fileName: `Permit-${permit.reference}.pdf`
        });
      }

      pdf.save(`Permit-${permit.reference}.pdf`);
      toast({ title: 'PDF Ready', description: 'Digital permit generated and shared.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const displayArea = permit.customAreaName || project?.areas?.find(a => a.id === permit.areaId)?.name || 'General Site';

  return (
    <>
      <Card 
        className={cn(
          "transition-all shadow-sm group border-l-4 overflow-hidden",
          isDraft ? "border-orange-200 border-l-orange-400 bg-orange-50/5" :
          isClosed ? "border-l-muted opacity-75" :
          isExpired ? "border-l-destructive bg-destructive/5" : "border-l-primary"
        )}
      >
        <CardHeader className="p-4 md:p-6 pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "font-mono text-[10px] bg-background shrink-0",
                  isDraft ? "border-orange-200 text-orange-600" : "text-primary border-primary/20"
                )}>{permit.reference}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">{permit.description}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground uppercase tracking-tight text-[10px] bg-muted px-1.5 rounded flex items-center gap-1 shrink-0">
                    <HardHat className="h-2.5 w-2.5" /> {permit.contractorName}
                </span>
                <span className="font-semibold text-foreground flex items-center gap-1 truncate">
                    <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" /> {project?.name || 'Unknown'} - {displayArea}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <TooltipProvider>
                {isDraft ? (
                  <>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 uppercase font-bold text-[9px]">DRAFT</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-50" onClick={handleIssue} disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Issue Permit</p></TooltipContent>
                    </Tooltip>
                  </>
                ) : isClosed ? (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 uppercase font-bold text-[9px]">CLOSED</Badge>
                ) : (
                  <>
                    <Badge className={cn("capitalize text-[10px] font-black tracking-widest px-2 h-5", isExpired ? "bg-destructive" : "bg-green-600")}>
                        {isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handleClose} disabled={isPending}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Sign-off Work</p></TooltipContent>
                    </Tooltip>
                  </>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDFAndEmail} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Export & Email PDF</p></TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsEditDialogOpen(true)}>
                        <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Record</p></TooltipContent>
                        </Tooltip>
                        <AlertDialogContent onClick={e => e.stopPropagation()}>
                            <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>Permanently remove permit audit trail for {permit.reference}.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/10">{permit.type}</Badge>
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground h-8 border border-dashed border-muted-foreground/20">
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                    {isExpanded ? "Hide Controls" : "View Safety Controls"}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
                <Accordion type="multiple" defaultValue={(permit.sections || []).map(s => s.id)} className="space-y-2">
                    {(permit.sections || []).map((section) => (
                        <AccordionItem key={section.id} value={section.id} className="border rounded-lg bg-muted/5 overflow-hidden">
                            <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/10 border-none">
                                <div className="flex items-center gap-2">
                                    <Layout className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">{section.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className={cn(
                                            "flex flex-col p-2 rounded border bg-background gap-2",
                                            field.width === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1'
                                        )}>
                                            <span className="text-[11px] font-bold truncate">{field.label}</span>
                                            <div className="flex shrink-0">
                                                {field.type === 'checkbox' ? (
                                                    field.value === true ? <Check className="h-3 w-3 text-green-600" /> : <Minus className="h-3 w-3 text-muted-foreground/30" />
                                                ) : field.type === 'yes-no-na' ? (
                                                    <Badge variant="outline" className={cn(
                                                        "text-[8px] h-4 px-1 leading-none font-bold border-transparent",
                                                        field.value === 'yes' ? "bg-green-50 text-green-700" :
                                                        field.value === 'no' ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {String(field.value || '---').toUpperCase()}
                                                    </Badge>
                                                ) : field.type === 'photo' && Array.isArray(field.value) ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {field.value.map((p: Photo, pi: number) => (
                                                            <div key={pi} className="relative w-8 h-6 rounded overflow-hidden border cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                                                                <Image src={p.url} alt="Verification" fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : field.type === 'date' && field.value ? (
                                                    <span className="text-[10px] font-mono text-primary">{new Date(field.value).toLocaleDateString()}</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-primary truncate max-w-[100px]">{field.value || '---'}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Valid From</p>
                  <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> <ClientDate date={permit.validFrom} /></p>
              </div>
              <div className="space-y-1 text-right">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Valid Until</p>
                  <p className={cn("font-medium flex items-center justify-end gap-1", isExpired && "text-destructive font-bold")}>
                      <Clock className="h-3 w-3" /> <ClientDate date={permit.validTo} />
                  </p>
              </div>
          </div>
        </CardContent>
      </Card>

      <EditPermitDialog 
        permit={permit} 
        projects={projects} 
        subContractors={subContractors} 
        allPermits={allPermits}
        currentUser={currentUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
