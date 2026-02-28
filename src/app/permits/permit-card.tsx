
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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardHat,
  MapPin,
  Calendar,
  Maximize2
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
        toast({ title: 'Permit Closed', description: 'Work signed off and permit archived.' });
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
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Issued To (Contractor)</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${permit.contractorName}</p>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Location / Area</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${project?.name || 'Project'} - ${areaName}</p>
            </div>
          </div>

          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 14px; color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;">WORK DESCRIPTION</h2>
            <p style="font-size: 13px; line-height: 1.6;">${permit.description}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
            <div>
              <h2 style="font-size: 14px; color: #dc2626; border-bottom: 1px solid #fee2e2; padding-bottom: 5px; margin-bottom: 10px;">KEY HAZARDS</h2>
              <p style="font-size: 12px; line-height: 1.5; white-space: pre-wrap;">${permit.hazards}</p>
            </div>
            <div>
              <h2 style="font-size: 14px; color: #16a34a; border-bottom: 1px solid #dcfce7; padding-bottom: 5px; margin-bottom: 10px;">SAFETY PRECAUTIONS</h2>
              <p style="font-size: 12px; line-height: 1.5; white-space: pre-wrap;">${permit.precautions}</p>
            </div>
          </div>

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
              <p style="margin: 0; font-size: 10px; font-weight: bold;">AUTHORIZED BY (SITE MANAGER)</p>
              <p style="margin: 5px 0 0 0; font-size: 12px;">${permit.createdByEmail}</p>
            </div>
            <div style="border-top: 1px solid #334155; padding-top: 10px;">
              <p style="margin: 0; font-size: 10px; font-weight: bold;">CONTRACTOR ACCEPTANCE (DIGITAL)</p>
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
      
      // Email to contractor if they have a valid email
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
      toast({ title: 'PDF Ready', description: 'Permit generated and shared with contractor.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF permit.', variant: 'destructive' });
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
                      <TooltipContent><p>Close/Sign-off Permit</p></TooltipContent>
                    </Tooltip>
                  </>
                )}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={generatePDFAndEmail} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download & Shared PDF</p></TooltipContent>
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
                    <AlertDialogHeader><AlertDialogTitle>Delete Permit Record?</AlertDialogTitle><AlertDialogDescription>This will remove permit {permit.reference} from the audit history.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{permit.description}</p>
            
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
                            <div className="absolute inset-0 bg-black/10 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="h-3 w-3 text-white" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
