'use client';

import { useState } from 'react';
import type { CleanUpNotice, Project, Photo } from '@/lib/types';
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
import { Camera, Users, Trash2, Maximize2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '../../components/client-date';
import { useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
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

type NoticeCardProps = {
  notice: CleanUpNotice;
  projects: Project[];
};

export function NoticeCard({
  notice,
  projects,
}: NoticeCardProps) {
  const project = projects.find((p) => p.id === notice.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{project?.name || 'Unknown Project'}</CardTitle>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                  <ClientDate date={notice.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Clean Up Notice</Badge>
              
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
          <p className="text-sm text-foreground mb-4">{notice.description}</p>
          <Accordion type="single" collapsible className="w-full">
            {notice.recipients && notice.recipients.length > 0 && (
               <AccordionItem value="recipients">
               <AccordionTrigger className="text-sm font-semibold">
                 <div className="flex items-center gap-2">
                   <Users className="h-4 w-4" />
                   <span>
                     Notified Sub-Contractors ({notice.recipients.length})
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
