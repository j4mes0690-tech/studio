
'use client';

import { useState } from 'react';
import type { Instruction, Project, Photo } from '@/lib/types';
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
import { CheckSquare, MessageCircle, Camera, Users, Trash2, Maximize2, Link as LinkIcon, FileText, Download } from 'lucide-react';
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

type InstructionCardProps = {
  instruction: Instruction;
  projects: Project[];
};

export function InstructionCard({
  instruction,
  projects,
}: InstructionCardProps) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'instructions', instruction.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Instruction deleted.' }))
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
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{project?.name || 'Unknown Project'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">{instruction.reference}</Badge>
              </div>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                  <ClientDate date={instruction.createdAt} />
                </span>
                {instruction.clientInstructionId && (
                    <Badge variant="secondary" className="text-[9px] gap-1 h-4 px-1.5 font-normal">
                        <LinkIcon className="h-2 w-2" /> Linked to Client Directive
                    </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Site Instruction</Badge>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Delete Instruction</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Instruction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
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
          <p className="text-sm text-foreground mb-4">{instruction.summary}</p>
          
          {instruction.files && instruction.files.length > 0 && (
            <div className="mb-4 space-y-1 border rounded-lg p-3 bg-muted/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                <FileText className="h-3 w-3" /> Attached Documentation
              </p>
              {instruction.files.map((f, i) => (
                <a key={i} href={f.url} download={f.name} className="flex items-center gap-2 p-2 rounded text-[10px] bg-background border text-primary hover:bg-accent group">
                  <FileText className="h-3.5 w-3.5" /> 
                  <span className="truncate flex-1 font-medium">{f.name}</span> 
                  <Download className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="action-items">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <span>
                    Action Items ({instruction.actionItems.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                  {instruction.actionItems.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
            {instruction.recipients && instruction.recipients.length > 0 && (
               <AccordionItem value="recipients">
               <AccordionTrigger className="text-sm font-semibold">
                 <div className="flex items-center gap-2">
                   <Users className="h-4 w-4" />
                   <span>
                     Distribution List ({instruction.recipients.length})
                   </span>
                 </div>
               </AccordionTrigger>
               <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {instruction.recipients.map((email, index) => (
                    <Badge key={index} variant="outline" className="bg-background">{email}</Badge>
                  ))}
                </div>
               </AccordionContent>
             </AccordionItem>
            )}
            {instruction.photos && instruction.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <span>Attached Photos ({instruction.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>
                      {instruction.photos.map((photo, index) => (
                        <CarouselItem key={index}>
                          <div className="p-1">
                            <div className="space-y-2">
                              <div className="relative cursor-pointer hover:opacity-95 transition-opacity group" onClick={() => setViewingPhoto(photo)}>
                                <Image
                                  src={photo.url}
                                  alt={`Instruction photo ${index + 1}`}
                                  width={600}
                                  height={400}
                                  className="rounded-md border object-cover aspect-video"
                                  data-ai-hint="construction site"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Maximize2 className="h-6 w-6 text-white" />
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
                     {instruction.photos.length > 1 && (
                      <>
                        <CarouselPrevious />
                        <CarouselNext />
                      </>
                    )}
                  </Carousel>
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="original-text">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Original Context</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {instruction.originalText}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
