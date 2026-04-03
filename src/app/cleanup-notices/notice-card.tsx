'use client';

import { useState } from 'react';
import type { CleanUpNotice, Project, Photo, SubContractor, DistributionUser } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { ClientDate } from '@/components/client-date';
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
import { DistributeNoticeButton } from './distribute-notice-button';

type NoticeCardProps = {
  notice: CleanUpNotice;
  projects: Project[];
  subContractors: SubContractor[];
  allUsers: DistributionUser[];
};

export function NoticeCard({
  notice,
  projects,
  subContractors,
  allUsers,
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
        await updateDoc(doc(db, 'cleanup-notices', notice.id), { status: 'issued' });
        toast({ title: 'Notice Issued', description: 'Status updated to issued. Use the distribute button to email partners.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to issue notice.', variant: 'destructive' });
      }
    });
  };

  const handleToggleItemStatus = (itemId: string) => {
    startTransition(async () => {
      try {
        const newItems = (notice.items || []).map(item => 
          item.id === itemId ? { ...item, status: (item.status === 'open' ? 'closed' : 'open') as 'open' | 'closed' } : item
        );
        await updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItems });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update item status.', variant: 'destructive' });
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
                <>
                  <Badge variant="destructive" className="uppercase font-black text-[9px] tracking-widest h-5">ISSUED</Badge>
                  <DistributeNoticeButton 
                    notice={notice} 
                    project={project} 
                    subContractors={subContractors} 
                    allUsers={allUsers} 
                  />
                </>
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
                              <button 
                                  className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
                                  onClick={() => handleToggleItemStatus(subItem.id)}
                                  disabled={isPending}
                              >
                                  {subItem.status === 'closed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              </button>
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
                    <Camera className="h-4 w-4" />
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
