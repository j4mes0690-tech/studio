
'use client';

import { useState, useMemo } from 'react';
import type { Instruction, Project, Photo, DistributionUser, SubContractor } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
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
import { Camera, Trash2, Maximize2, Link as LinkIcon, FileText, Download, HardHat, Ruler, ExternalLink, CheckCircle2, Pencil } from 'lucide-react';
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
import { EditInstruction } from './edit-instruction';
import { DistributeInstructionButton } from './distribute-instruction-button';
import { DownloadInstructionButton } from './download-instruction-button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type InstructionCardProps = {
  instruction: Instruction;
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
  onDelete?: () => void;
};

export function InstructionCard({
  instruction,
  projects,
  distributionUsers,
  subContractors,
  onDelete
}: InstructionCardProps) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'instructions', instruction.id);
      deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Success', description: 'Instruction deleted.' });
          if (onDelete) onDelete();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const instructedParty = useMemo(() => {
    return subContractors.find(s => instruction.recipients?.includes(s.email));
  }, [subContractors, instruction.recipients]);

  const isIssued = instruction.status === 'issued' && !!instruction.distributedAt;
  const isDraft = !isIssued;

  return (
    <>
      <Card className={cn(
        "border-l-4 transition-all", 
        isDraft ? "border-orange-200 border-l-orange-400 bg-orange-50/10" : "border-l-green-500"
      )}>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/instructions/${instruction.id}`} className="group flex items-center gap-2 min-w-0">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors truncate">{project?.name || 'Unknown Project'}</CardTitle>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
                <Badge variant="outline" className="font-mono text-[10px] bg-background shrink-0">{instruction.reference}</Badge>
                
                {isIssued ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 cursor-help text-[10px] uppercase font-bold tracking-tight shrink-0">
                          ISSUED
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Distributed: {new Date(instruction.distributedAt!).toLocaleString()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] uppercase font-bold tracking-tight shrink-0">DRAFT</Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-muted-foreground/80">
                  Logged <ClientDate date={instruction.createdAt} />
                </span>
                {instruction.clientInstructionId && (
                    <Link href={`/client-instructions/${instruction.clientInstructionId}`}>
                        <Badge variant="secondary" className="text-[9px] gap-1 h-4 px-1.5 font-normal hover:bg-secondary/80 transition-colors cursor-pointer">
                            <LinkIcon className="h-2 w-2" /> Linked to Client Directive
                        </Badge>
                    </Link>
                )}
              </CardDescription>
              
              {instructedParty && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">Instructed:</span>
                  <Badge variant="default" className="gap-1.5 h-5 px-2 text-[10px] bg-primary/10 text-primary border-primary/20 truncate">
                    {instructedParty.isDesigner ? <Ruler className="h-2.5 w-2.5" /> : <HardHat className="h-2.5 w-2.5" />}
                    {instructedParty.name}
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <DownloadInstructionButton 
                instruction={instruction}
                project={project}
                subContractors={subContractors}
              />

              <DistributeInstructionButton 
                instruction={instruction} 
                project={project} 
                subContractors={subContractors} 
              />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary h-8 w-8" onClick={() => setIsEditDialogOpen(true)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Edit Instruction</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <EditInstruction 
                item={instruction} 
                projects={projects} 
                distributionUsers={distributionUsers} 
                subContractors={subContractors}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                    <Trash2 className="h-4 w-4" />
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
          <div className="bg-muted/5 p-4 rounded-lg border mb-4">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{instruction.originalText}</p>
          </div>
          
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
          </Accordion>
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
