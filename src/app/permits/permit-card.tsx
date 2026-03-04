
'use client';

import { useState, useTransition } from 'react';
import type { Permit, Project, SubContractor, DistributionUser, Photo } from '@/lib/types';
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
  FileCheck,
  Check,
  X as XIcon,
  Minus
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
import { EditPermitDialog } from './edit-permit';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { sendPermitEmailAction } from './actions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

      const areaName = project?.areas?.find(a => a.id === permit.areaId)?.name || 'General Site';

      reportElement.innerHTML = `
        <div style="border: 4px solid #1e40af; padding: 30px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
              <h1 style="margin: 0; color: #1e40af; font-size: 32px; letter-spacing: -1px;">PERMIT TO WORK</h1>
              <p style="margin: 5px 0 0 0; font-weight: bold; color: #dc2626;">Ref: ${permit.reference}</p>
            </div>
            <div style="text-align: right; background: #1e40af; color: white; padding: 10px 20px; border-radius: 4px;">
              <p style="margin: 0; font-size: 18px; font-weight: bold;">${permit.type.toUpperCase()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Instructed Party</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${permit.contractorName}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Project / Location</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${project?.name || 'Project'} - ${areaName}</p>
              ${project?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569; white-space: pre-wrap;">${project.address}</p>` : ''}
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 14px; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;">WORK DESCRIPTION</h2>
            <p style="font-size: 13px; line-height: 1.6;">${permit.description}</p>
          </div>

          <!-- Dynamic Sections Engine -->
          ${(permit.sections || []).map(section => `
            <div style="margin-bottom: 30px;">
              <h3 style="font-size: 12px; color: #334155; background: #f1f5f9; padding: 8px; margin-bottom: 15px; font-weight: bold; text-transform: uppercase;">${section.title}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                ${section.fields.map(f => {
                  let valueDisplay = f.value || '---';
                  if (f.type === 'checkbox') valueDisplay = f.value ? 'YES' : 'NO';
                  if (f.type === 'yes-no-na') valueDisplay = String(f.value).toUpperCase();

                  return `
                    <div style="display: flex; align-items: flex-start; gap: 10px; border: 1px solid #f1f5f9; padding: 8px; border-radius: 4px;">
                      <div style="flex: 1;">
                        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">${f.label}</p>
                        <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: bold; color: ${f.value === 'no' ? '#dc2626' : '#1e293b'};">${valueDisplay}</p>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}

          <div style="background: #fffbeb; border: 2px solid #fde68a; padding: 20px; border-radius: 8px; margin-bottom: 40px; display: flex; justify-content: space-between;">
            <div>
              <p style="margin: 0; font-size: 10px; font-weight: bold; color: #92400e;">VALID FROM</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">${new Date(permit.validFrom).toLocaleString()}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 10px; font-weight: bold; color: #92400e;">VALID UNTIL</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #dc2626;">${new Date(permit.validTo).toLocaleString()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 50px;">
            <div style="border-top: 1px solid #334155; padding-top: 10px;">
              <p style="margin: 0; font-size: 10px; font-weight: bold;">SITE AUTHORITY SIGNATURE</p>
              <p style="margin: 5px 0 0 0; font-size: 12px;">${project?.siteManager || permit.createdByEmail}</p>
              ${project?.siteManagerPhone ? `<p style="margin: 2px 0 0 0; font-size: 10px;">Tel: ${project.siteManagerPhone}</p>` : ''}
            </div>
            <div style="border-top: 1px solid #334155; padding-top: 10px;">
              <p style="margin: 0; font-size: 10px; font-weight: bold;">RECIPIENT ACCEPTANCE</p>
              <p style="margin: 5px 0 0 0; font-size: 12px;">${permit.contractorName}</p>
            </div>
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
      toast({ title: 'PDF Ready', description: 'Digital permit generated and shared with partner.' });
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
          isDraft ? "border-orange-200 border-l-orange-400 bg-orange-50/5" :
          isClosed ? "border-l-muted opacity-75" :
          isExpired ? "border-l-destructive bg-destructive/5" : "border-l-primary"
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
                )}>{permit.reference}</Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{permit.type}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-foreground uppercase tracking-tight text-[10px] bg-muted px-1.5 rounded flex items-center gap-1">
                    <HardHat className="h-2 w-2" /> {permit.contractorName}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600 hover:bg-orange-50" onClick={handleIssue} disabled={isPending}>
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Issue Permit</p></TooltipContent>
                    </Tooltip>
                  </>
                ) : isClosed ? (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600">CLOSED</Badge>
                ) : (
                  <>
                    <Badge className={cn("capitalize text-[10px]", isExpired ? "bg-destructive" : "bg-green-600")}>
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

                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Record</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>Permanently remove permit audit trail for {permit.reference}.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{permit.description}</p>
          
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground">
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                    {isExpanded ? "Hide Controls" : "View Safety Controls"}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-6">
                {(permit.sections || []).map((section) => (
                    <div key={section.id} className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">{section.title}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {section.fields.map((field) => (
                                <div key={field.id} className="flex items-center justify-between p-2 rounded border bg-muted/5 gap-4">
                                    <span className="text-[11px] font-medium truncate flex-1">{field.label}</span>
                                    <div className="flex shrink-0">
                                        {field.type === 'checkbox' ? (
                                            field.value === true ? <Check className="h-3 w-3 text-green-600" /> : <Minus className="h-3 w-3 text-muted-foreground/30" />
                                        ) : field.type === 'yes-no-na' ? (
                                            <Badge variant="outline" className={cn(
                                                "text-[8px] h-4 px-1 leading-none font-bold border-transparent",
                                                field.value === 'yes' ? 'bg-green-50 text-green-700' :
                                                field.value === 'no' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {String(field.value).toUpperCase()}
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] font-bold text-primary truncate max-w-[100px]">{field.value || '---'}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Valid From</p>
                  <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={permit.validFrom} /></p>
              </div>
              <div className="space-y-1 text-right">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Valid Until</p>
                  <p className={cn("font-medium flex items-center justify-end gap-1", isExpired && "text-destructive font-bold")}>
                      <Clock className="h-3 w-3" /> <ClientDate date={permit.validTo} />
                  </p>
              </div>
          </div>

          {permit.photos && permit.photos.length > 0 && (
              <div className="flex gap-1.5 flex-wrap pt-2">
                  {permit.photos.map((p, i) => (
                      <div key={i} className="relative w-10 h-10 rounded border overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                          <Image src={p.url} alt="Permit Attachment" fill className="object-cover" />
                      </div>
                  ))}
              </div>
          )}
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
