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
  AlertTriangle,
  Signature as SignatureIcon
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
import { generatePermitPDF } from '@/lib/pdf-utils';

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

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);
    try {
      const pdf = await generatePermitPDF(permit, project, subContractor);
      pdf.save(`Permit-${permit.reference}.pdf`);
      toast({ title: 'PDF Ready', description: 'Formal permit document generated.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate document.', variant: 'destructive' });
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
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleExportPDF} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download PDF Document</p></TooltipContent>
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
                <Button variant="ghost" size="sm" className="w-full text-xs gap-2 text-muted-foreground h-10 border border-dashed border-muted-foreground/20 rounded-lg">
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                    {isExpanded ? "Hide Details" : "View Details & Sign-off"}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-6">
                <Accordion type="multiple" defaultValue={(permit.sections || []).map(s => s.id)} className="space-y-3">
                    {(permit.sections || []).map((section) => (
                        <AccordionItem key={section.id} value={section.id} className="border rounded-xl bg-muted/5 overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/10 border-none">
                                <div className="flex items-center gap-2">
                                    <Layout className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">{section.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 border-t pt-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className={cn(
                                            "flex flex-col p-3 rounded-lg border bg-background gap-2 shadow-sm",
                                            field.width === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1'
                                        )}>
                                            <span className="text-[11px] font-bold text-muted-foreground leading-snug">{field.label}</span>
                                            <div className="flex shrink-0">
                                                {field.type === 'checkbox' ? (
                                                    field.value === true ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Minus className="h-4 w-4 text-muted-foreground/30" />
                                                ) : field.type === 'yes-no-na' ? (
                                                    <Badge variant="outline" className={cn(
                                                        "text-[9px] h-5 px-2 leading-none font-black border-transparent uppercase tracking-wider",
                                                        field.value === 'yes' ? "bg-green-50 text-green-700" :
                                                        field.value === 'no' ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {String(field.value || '---')}
                                                    </Badge>
                                                ) : field.type === 'photo' && Array.isArray(field.value) ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {field.value.map((p: Photo, pi: number) => (
                                                            <div key={pi} className="relative w-10 h-8 rounded border overflow-hidden cursor-pointer shadow-sm" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                                                                <Image src={p.url} alt="Verification" fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : field.type === 'date' && field.value ? (
                                                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{new Date(field.value).toLocaleDateString()}</span>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-primary truncate max-w-full">{field.value || '---'}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <SignatureIcon className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sign-off Log</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(permit.signatures || []).map((sig) => (
                            <div key={sig.id} className="bg-muted/10 p-3 rounded-xl border flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-foreground">{sig.name}</span>
                                    <Badge variant="outline" className="text-[8px] h-4 uppercase font-black tracking-tighter">
                                        {sig.role === 'site-manager' ? 'Manager' : 'Operative'}
                                    </Badge>
                                </div>
                                <div className="relative h-12 bg-white rounded border border-dashed flex items-center justify-center p-1">
                                    <img src={sig.signatureDataUri} alt="Signature" className="max-h-full max-w-full object-contain" />
                                </div>
                                <span className="text-[8px] text-muted-foreground text-center">Signed <ClientDate date={sig.signedAt} /></span>
                            </div>
                        ))}
                        {(!permit.signatures || permit.signatures.length === 0) && (
                            <p className="col-span-full py-4 text-center text-[10px] text-muted-foreground italic border border-dashed rounded-lg bg-muted/5">No digital signatures recorded.</p>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Valid From</p>
                  <p className="font-bold flex items-center gap-1.5"><Calendar className="h-3 w-3 text-primary" /> <ClientDate date={permit.validFrom} /></p>
              </div>
              <div className="space-y-1 text-right">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Valid Until</p>
                  <p className={cn("font-bold flex items-center justify-end gap-1.5", isExpired && "text-destructive")}>
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
