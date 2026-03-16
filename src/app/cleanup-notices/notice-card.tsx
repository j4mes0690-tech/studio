'use client';

import { useState } from 'react';
import type { CleanUpNotice, Project, Photo, SubContractor, DistributionUser } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Camera, Users, Trash2, Maximize2, CheckCircle2, Loader2, ListChecks, MapPin, Building2, Send, FileText, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '../../components/client-date';
import { useTransition, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/image-lightbox';
import { cn, getPartnerEmails } from '@/lib/utils';
import { sendCleanUpNoticeEmailAction } from './actions';
import { EditCleanUpNotice } from './edit-notice';
import { Progress } from '@/components/ui/progress';

type NoticeCardProps = {
  notice: CleanUpNotice;
  projects: Project[];
  subContractors: SubContractor[];
};

export function NoticeCard({
  notice,
  projects,
  subContractors,
}: NoticeCardProps) {
  const project = projects.find((p) => p.id === notice.projectId);
  const area = project?.areas?.find(a => a.id === notice.areaId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const totalItems = notice.items?.length || 0;
  const closedItems = notice.items?.filter(i => i.status === 'closed').length || 0;
  const progress = totalItems > 0 ? (closedItems / totalItems) * 100 : 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'cleanup-notices', notice.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Clean up notice deleted.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleIssue = () => {
    if (totalItems === 0) {
      toast({ title: "Requirements Not Met", description: "Add at least one cleaning requirement to issue this notice.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Generating reports and distributing...' });

        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        // Group items by Subcontractor for targeted distribution
        const subIds = new Set(notice.items.map(i => i.subContractorId).filter(id => !!id)) as Set<string>;
        
        for (const subId of subIds) {
            const sub = subContractors.find(s => s.id === subId);
            if (!sub) continue;

            const subItems = notice.items.filter(i => i.subContractorId === subId);
            
            const reportElement = document.createElement('div');
            reportElement.style.position = 'absolute';
            reportElement.style.left = '-9999px';
            reportElement.style.padding = '40px';
            reportElement.style.width = '800px';
            reportElement.style.background = 'white';
            reportElement.style.color = 'black';
            reportElement.style.fontFamily = 'sans-serif';

            reportElement.innerHTML = `
              <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Clean Up Notice</h1>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${notice.reference}</p>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p><p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Project'}</p></div>
                <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area</p><p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p></div>
              </div>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Requirements for ${sub.name}</h2>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${subItems.map(item => `<div style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><p style="margin: 0; font-size: 14px;">• ${item.description}</p></div>`).join('')}
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

            await sendCleanUpNoticeEmailAction({
              email: sub.email,
              name: sub.name,
              projectName: project?.name || 'Project',
              reference: notice.reference,
              pdfBase64,
              fileName: `CleanUpNotice-${notice.reference}.pdf`
            });
        }

        await updateDoc(doc(db, 'cleanup-notices', notice.id), { status: 'issued' });
        toast({ title: 'Success', description: 'Clean up notice issued and distributed.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to issue notice.', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <Card className={cn(notice.status === 'draft' && "border-orange-200 bg-orange-50/5")}>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{notice.title || 'Clean Up Notice'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                  {notice.reference}
                </Badge>
              </div>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="font-semibold text-foreground text-xs">{project?.name}</span>
                {area && (
                    <>
                        <span className="text-muted-foreground">&gt;</span>
                        <span className="text-primary font-bold text-xs">{area.name}</span>
                    </>
                )}
                <span className="text-xs text-muted-foreground/80 hidden sm:inline">•</span>
                <span className="text-xs text-muted-foreground/80">
                  Logged <ClientDate date={notice.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {notice.status === 'draft' ? (
                <>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 uppercase font-black text-[9px] tracking-widest h-5">DRAFT</Badge>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 font-bold" onClick={handleIssue} disabled={isPending}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Issue Notice
                  </Button>
                </>
              ) : (
                <Badge variant="destructive" className="uppercase font-black text-[9px] tracking-widest h-5">ISSUED</Badge>
              )}
              
              <EditCleanUpNotice 
                notice={notice} 
                projects={projects} 
                subContractors={subContractors} 
                open={isEditDialogOpen} 
                onOpenChange={setIsEditDialogOpen} 
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Clean Up Notice?</AlertDialogTitle>
                    <AlertDialogDescription>Permanently remove this requirement list and its history.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
              <div className='flex justify-between items-end mb-1'>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Progress</p>
                  <span className="text-xs font-bold text-primary">{closedItems}/{totalItems} Cleared</span>
              </div>
              <Progress value={progress} className="h-1.5" />
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="items">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span>Requirements ({totalItems})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-3 bg-muted/20 p-3 rounded-lg border">
                  {(notice.items || []).map((subItem) => {
                      const sub = subContractors.find(s => s.id === subItem.subContractorId);
                      return (
                          <div key={subItem.id} className="p-2.5 rounded-lg bg-background border shadow-sm flex items-start gap-3">
                              <div className="mt-0.5">
                                  {subItem.status === 'closed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <p className={cn("text-xs font-bold leading-relaxed", subItem.status === 'closed' && "line-through text-muted-foreground")}>{subItem.description}</p>
                                  {sub && <Badge variant="secondary" className="mt-1 text-[8px] h-4 bg-primary/5 text-primary border-primary/10">{sub.name}</Badge>}
                              </div>
                              {subItem.photos && subItem.photos.length > 0 && (
                                <div className="flex -space-x-2">
                                    {subItem.photos.slice(0, 2).map((p, i) => (
                                        <div key={i} className="h-6 w-6 rounded-full border-2 border-background overflow-hidden relative">
                                            <Image src={p.url} alt="Ev" fill className="object-cover" />
                                        </div>
                                    ))}
                                </div>
                              )}
                          </div>
                      );
                  })}
                  {totalItems === 0 && <p className="text-center py-4 text-xs text-muted-foreground italic">No specific requirements added.</p>}
                </div>
              </AccordionContent>
            </AccordionItem>

            {notice.photos && notice.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>General Photos ({notice.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>
                      {notice.photos.map((photo, index) => (
                        <CarouselItem key={index}>
                          <div className="p-1">
                            <div className="relative aspect-video cursor-pointer rounded-md overflow-hidden group border" onClick={() => setViewingPhoto(photo)}>
                                <Image src={photo.url} alt="Site" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 className="h-5 w-5 text-white" />
                                </div>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {notice.photos.length > 1 && <><CarouselPrevious /><CarouselNext /></>}
                  </Carousel>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
