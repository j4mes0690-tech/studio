'use client';

import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
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
import { Camera, ListChecks, CheckCircle2, Circle, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EditSnaggingItem } from '@/app/snagging/edit-snagging-item';
import { PdfReportButton } from '@/app/snagging/pdf-report-button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '@/components/client-date';
import { cn } from '@/lib/utils';
import { useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

type SnaggingItemCardProps = {
  item: SnaggingItem;
  projects: Project[];
  subContractors: SubContractor[];
};

export function SnaggingItemCard({
  item,
  projects,
  subContractors,
}: SnaggingItemCardProps) {
  const project = projects.find((p) => p.id === item.projectId);
  const area = project?.areas?.find((a) => a.id === item.areaId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const toggleItemStatus = (itemId: string) => {
    startTransition(async () => {
        const updatedItems = item.items.map(i => 
            i.id === itemId ? { ...i, status: i.status === 'open' ? 'closed' : 'open' } : i
        );
        const docRef = doc(db, 'snagging-items', item.id);
        const updates = { items: updatedItems };
        
        updateDoc(docRef, updates)
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
    });
  };

  const handleDeleteList = () => {
    startTransition(async () => {
      const docRef = doc(db, 'snagging-items', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Snagging list deleted.' }))
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
    <Card className={cn(isComplete && "bg-muted/30")}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {item.title}
              {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
              {area && (
                <>
                  <span className="text-muted-foreground">&gt;</span>
                  <span>{area.name}</span>
                </>
              )}
              <span className="hidden sm:inline text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground/80">
                Logged <ClientDate date={item.createdAt} />
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isComplete ? "secondary" : "outline"} className="capitalize">
                {isComplete ? "Completed" : `${closedItems}/${totalItems} Done`}
            </Badge>
            
            <PdfReportButton 
              item={item} 
              project={project} 
              subContractors={subContractors} 
            />
            
            <EditSnaggingItem item={item} projects={projects} subContractors={subContractors} />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete List</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Snagging List?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this entire list and all its associated items. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteList} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                    {isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {item.description && <p className="text-sm text-foreground mb-4">{item.description}</p>}
        
        <div className="space-y-4 mb-6 bg-muted/20 p-4 rounded-lg border">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
                <ListChecks className="h-4 w-4" />
                <span>Items to Address</span>
            </div>
            {item.items?.map((subItem) => {
                const sub = subContractors.find(s => s.id === subItem.subContractorId);
                return (
                    <div key={subItem.id} className="space-y-2 group">
                        <div className="flex items-start gap-2">
                            <button 
                                onClick={() => toggleItemStatus(subItem.id)}
                                disabled={isPending}
                                className="mt-0.5 flex-shrink-0 transition-colors"
                            >
                                {subItem.status === 'closed' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                )}
                            </button>
                            <div className="flex flex-col">
                                <span className={cn("text-sm", subItem.status === 'closed' && "line-through text-muted-foreground")}>
                                    {subItem.description}
                                </span>
                                {sub && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-auto font-normal gap-1">
                                            <User className="h-2 w-2" />
                                            {sub.name}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                        {subItem.photos && subItem.photos.length > 0 && (
                            <div className="flex flex-wrap gap-2 pl-6">
                                {subItem.photos.map((p, idx) => (
                                    <div key={idx} className="relative w-16 h-12">
                                        <Image 
                                            src={p.url} 
                                            alt={`Item specific photo ${idx + 1}`} 
                                            fill 
                                            className="rounded object-cover border" 
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        <Accordion type="single" collapsible className="w-full">
          {item.photos && item.photos.length > 0 && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>General Photos ({item.photos.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Carousel className="w-full max-w-sm mx-auto">
                  <CarouselContent>
                    {item.photos.map((photo, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                           <div className="space-y-2">
                            <Image
                              src={photo.url}
                              alt={`Snagging item photo ${index + 1}`}
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                              data-ai-hint="construction defect"
                            />
                            <p className="text-xs text-muted-foreground text-center">
                              Taken on: <ClientDate date={photo.takenAt} />
                            </p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                   {item.photos.length > 1 && (
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
  );
}
