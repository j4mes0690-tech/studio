'use client';

import { useState } from 'react';
import type { CleanUpNotice, Project, Photo, SubContractor } from '@/lib/types';
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
import { Camera, Users, Trash2, Maximize2, CheckCircle2, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { sendCleanUpNoticeEmailAction } from './actions';
import { EditCleanUpNotice } from './edit-notice';

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
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = notice.status === 'draft';

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
    const hasText = notice.description && notice.description.trim().length >= 10;
    const hasRecipients = notice.recipients && notice.recipients.length > 0;

    if (!hasText || !hasRecipients) {
      toast({ 
        title: "Requirements Not Met", 
        description: "A full description (min 10 chars) and assigned sub-contractors are required to formally issue this notice.", 
        variant: "destructive" 
      });
      setIsEditDialogOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Generating report and distributing...' });

        // 1. Generate PDF & Distribute
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

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
            <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Date Issued</p><p style="margin: 2px 0 0 0; font-size: 16px;">${new Date().toLocaleDateString()}</p></div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Issue Description</h2>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${notice.description}</p>
          </div>
          ${notice.photos && notice.photos.length > 0 ? `
            <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              ${notice.photos.map(p => `<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 10px;"><img src="${p.url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;" /></div>`).join('')}
            </div>
          ` : ''}
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

        if (subContractors && notice.recipients) {
          const contacts = subContractors.filter(s => notice.recipients?.includes(s.email));
          for (const sub of contacts) {
            await sendCleanUpNoticeEmailAction({
              email: sub.email,
              name: sub.name,
              projectName: project?.name || 'Project',
              reference: notice.reference,
              pdfBase64,
              fileName: `CleanUpNotice-${notice.reference}.pdf`
            });
          }
        }

        // 2. Update Status in Firestore
        const docRef = doc(db, 'cleanup-notices', notice.id);
        await updateDoc(docRef, { status: 'issued' });
        
        toast({ title: 'Success', description: 'Clean up notice issued and distributed.' });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to issue notice.', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <Card className={cn(isDraft && "border-orange-200 bg-orange-50/10")}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{project?.name || 'Unknown Project'}</CardTitle>
                {notice.reference && (
                  <Badge variant="outline" className="font-mono text-[10px] bg-background">
                    {notice.reference}
                  </Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                  Logged <ClientDate date={notice.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isDraft ? (
                <>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">DRAFT</Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
                    onClick={handleIssue}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Issue & Distribute
                  </Button>
                </>
              ) : (
                <Badge variant="destructive">Clean Up Notice</Badge>
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
                    <span className="sr-only">Delete Notice</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Clean Up Notice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this clean up notice record. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                      {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground mb-4">{notice.description || <span className="italic text-muted-foreground">No description provided</span>}</p>
          <Accordion type="single" collapsible className="w-full">
            {notice.recipients && notice.recipients.length > 0 && (
               <AccordionItem value="recipients">
               <AccordionTrigger className="text-sm font-semibold">
                 <div className="flex items-center gap-2">
                   <Users className="h-4 w-4" />
                   <span>
                     Notified Sub-contractors ({notice.recipients.length})
                   </span>
                 </div>
               </AccordionTrigger>
               <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {notice.recipients.map((email, index) => (
                    <Badge key={index} variant="outline" className="bg-background">{email}</Badge>
                  ))}
                </div>
               </AccordionContent>
             </AccordionItem>
            )}
            {notice.photos && notice.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <span>Attached Photos ({notice.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>
                      {notice.photos.map((photo, index) => (
                        <CarouselItem key={index}>
                          <div className="p-1">
                            <div className="space-y-2">
                              <div className="relative cursor-pointer hover:opacity-95 transition-opacity group" onClick={() => setViewingPhoto(photo)}>
                                <Image
                                  src={photo.url}
                                  alt={`Clean up notice photo ${index + 1}`}
                                  width={600}
                                  height={400}
                                  className="rounded-md border object-cover aspect-video"
                                  data-ai-hint="construction mess debris"
                                />
                                <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Maximize2 className="h-4 w-4" />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground text-center">
                                Taken on:{' '}
                                <ClientDate date={photo.takenAt} />
                              </p>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {notice.photos.length > 1 && (
                      <>
                        <CarouselPrevious />
                        <CarouselNext />
                      </>
                    )}
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
