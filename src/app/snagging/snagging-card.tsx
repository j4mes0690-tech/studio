'use client';

import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, SnaggingHistoryRecord, DistributionUser } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  ListChecks, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  User, 
  Maximize2, 
  ExternalLink, 
  History, 
  FileSearch, 
  MapPin, 
  Clock,
  Loader2,
  FileText,
  Send
} from 'lucide-react';
import { PdfReportButton } from '@/app/snagging/pdf-report-button';
import { DistributeReportsButton } from '@/app/snagging/distribute-reports-button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '../../components/client-date';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, deleteDoc, collection, query, orderBy } from 'firebase/firestore';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageLightbox } from '@/components/image-lightbox';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const { user: sessionUser } = useUser();

  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const historyQuery = useMemoFirebase(() => {
    if (!db || !item.id) return null;
    return query(collection(db, 'snagging-items', item.id, 'history'), orderBy('timestamp', 'desc'));
  }, [db, item.id]);
  const { data: history } = useCollection<SnaggingHistoryRecord>(historyQuery);

  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const sortedSubItems = useMemo(() => {
    if (!item.items) return [];
    return [...item.items].sort((a, b) => {
      const statusWeight = {
        'open': 0,
        'provisionally-complete': 1,
        'closed': 2
      };
      return statusWeight[a.status] - statusWeight[b.status];
    });
  }, [item.items]);

  const handleDeleteList = () => {
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
  };

  return (
    <>
      <Card className="transition-all hover:bg-muted/5 hover:border-primary/50 shadow-md">
        <CardHeader className="p-4 md:p-6">
          <div className="flex justify-between items-start">
            <Link href={`/snagging/${item.id}`} className="space-y-1 flex-1 group">
              <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors text-base md:text-lg">
                <span className="truncate max-w-[180px] sm:max-w-none">{item.title}</span>
                {isComplete && <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500 shrink-0" />}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
              </CardTitle>
              <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="font-semibold text-foreground text-xs md:text-sm">{project?.name || 'Unknown'}</span>
                {area && (
                  <>
                    <span className="text-muted-foreground">&gt;</span>
                    <span className="flex items-center gap-1 font-bold text-primary text-xs">
                      <MapPin className="h-3 w-3" />
                      {area.name}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline text-muted-foreground">•</span>
                <span className="text-[10px] md:text-xs text-muted-foreground/80 font-medium whitespace-nowrap">
                  Logged <ClientDate date={item.createdAt} format="date" />
                </span>
              </CardDescription>
            </Link>
            <div className="flex items-center gap-1 md:gap-2" onClick={(e) => e.stopPropagation()}>
              <Badge variant={isComplete ? "secondary" : "outline"} className="capitalize text-[9px] md:text-[10px] font-bold px-1.5 md:px-2.5 h-5 md:h-6 whitespace-nowrap">
                  {isComplete ? "Ready" : `${closedItems}/${totalItems}`}
              </Badge>
              
              <div className="flex items-center gap-1">
                <PdfReportButton item={item} project={project} subContractors={subContractors} />
                <DistributeReportsButton item={item} project={project} subContractors={subContractors} />
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete List</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[95vw] max-w-lg rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Snagging List?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the entire list: <strong>{item.title}</strong>. This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteList} className="bg-destructive hover:bg-destructive/90">
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="items" className="border-b-0">
              <AccordionTrigger className="text-xs md:text-sm font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  <span>Defect Items Summary ({closedItems}/{totalItems})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-3 bg-muted/20 p-3 md:p-4 rounded-lg border shadow-inner">
                  {sortedSubItems?.map((subItem) => {
                      const sub = subContractors.find(s => s.id === subItem.subContractorId);
                      
                      return (
                          <div key={subItem.id} className="p-2.5 md:p-3 rounded-lg bg-background border shadow-sm group">
                              <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                      <div className="mt-0.5 flex-shrink-0">
                                          {subItem.status === 'closed' ? (
                                              <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                                          ) : subItem.status === 'provisionally-complete' ? (
                                              <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                                          ) : (
                                              <Circle className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                                          )}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                          <span className={cn(
                                                "text-xs md:text-sm font-semibold leading-snug break-words", 
                                                subItem.status === 'closed' && "line-through text-muted-foreground"
                                            )}>
                                              {subItem.description}
                                          </span>
                                          {sub && (
                                              <Badge variant="secondary" className="w-fit text-[8px] md:text-[9px] mt-1 gap-1 font-bold bg-primary/10 text-primary border-primary/20 h-4 truncate max-w-[120px] md:max-w-none">
                                                  <User className="h-2 w-2" /> {sub.name}
                                              </Badge>
                                          )}
                                      </div>
                                  </div>
                                  
                                  <Badge variant="outline" className={cn(
                                      "text-[8px] md:text-[9px] font-black uppercase tracking-tighter h-4 px-1.5 whitespace-nowrap shrink-0",
                                      subItem.status === 'closed' ? "bg-green-50 text-green-700 border-green-200" :
                                      subItem.status === 'provisionally-complete' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground"
                                  )}>
                                      {subItem.status.replace('-', ' ')}
                                  </Badge>
                              </div>
                              
                              {subItem.subContractorComment && (
                                  <div className="ml-7 p-2 rounded bg-muted/30 border-l-2 border-primary/20 text-[10px] md:text-xs italic text-muted-foreground leading-relaxed">
                                      "{subItem.subContractorComment}"
                                  </div>
                              )}

                              {(subItem.photos && subItem.photos.length > 0) || (subItem.completionPhotos && subItem.completionPhotos.length > 0) ? (
                                <div className="pl-7 flex flex-wrap gap-1.5 pt-1">
                                  {subItem.photos?.map((p, idx) => (
                                    <div key={idx} className="relative w-12 h-9 md:w-16 md:h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                      <Image src={p.url} alt="Defect" fill className="object-cover" />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Maximize2 className="h-3 w-3 text-white" />
                                      </div>
                                    </div>
                                  ))}
                                  {subItem.completionPhotos?.map((p, idx) => (
                                    <div key={idx} className="relative w-12 h-9 md:w-16 md:h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border-2 border-green-200 bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                      <Image src={p.url} alt="Fixed" fill className="object-cover" />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Maximize2 className="h-3 w-3 text-white" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                          </div>
                      );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history">
                <AccordionTrigger className="text-xs md:text-sm font-semibold">
                    <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                        <span>Audit Log ({history?.length || 0})</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                    <ScrollArea className="h-40 md:h-48 rounded-md border bg-muted/5 p-3 md:p-4">
                        <div className="space-y-3">
                            {history && history.length > 0 ? history.map((record, idx) => (
                                <div 
                                    key={record.id} 
                                    className="relative pl-4 border-l-2 border-primary/20 pb-2 last:pb-0 cursor-pointer group/hist transition-colors hover:bg-primary/5 rounded-r-md"
                                    onClick={() => setViewingHistoryRecord(record)}
                                >
                                    <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between">
                                            <div className='flex items-center gap-1.5'>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-primary">V{history.length - idx}</span>
                                                {idx === 0 && (
                                                  <Badge variant="secondary" className="h-3.5 px-1 text-[7px] bg-green-100 text-green-800 border-green-200 font-black tracking-tighter">
                                                    ACTIVE
                                                  </Badge>
                                                )}
                                            </div>
                                            <span className="text-[8px] md:text-[9px] text-muted-foreground"><ClientDate date={record.timestamp} format="date" /></span>
                                        </div>
                                        <p className="text-[10px] md:text-xs font-medium text-foreground truncate">{record.summary}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-center text-muted-foreground py-6 italic">No history recorded.</p>
                            )}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>

            {item.photos && item.photos.length > 0 && (
              <AccordionItem value="photo" className="border-b-0">
                <AccordionTrigger className="text-xs md:text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    <span>General Photos ({item.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-[280px] sm:max-w-sm mx-auto">
                    <CarouselContent>
                      {item.photos.map((photo, index) => (
                        <CarouselItem key={index}>
                          <div className="p-1">
                             <div className="space-y-2">
                              <div className="relative cursor-pointer hover:opacity-95 transition-opacity group" onClick={() => setViewingPhoto(photo)}>
                                  <Image src={photo.url} alt="asset" width={600} height={400} className="rounded-md border object-cover aspect-video" />
                                  <div className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 className="h-3.5 w-3.5 text-white" />
                                  </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground text-center font-medium">
                                <ClientDate date={photo.takenAt} format="date" />
                              </p>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                     {item.photos.length > 1 && (
                      <div className="hidden sm:block">
                        <CarouselPrevious className="-left-10" />
                        <CarouselNext className="-right-10" />
                      </div>
                    )}
                  </Carousel>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl shadow-2xl">
              <DialogHeader className="p-4 md:p-6 pb-0 shrink-0">
                  <div className='flex items-center gap-3 mb-1'>
                      <div className='bg-primary/10 p-2 rounded-lg text-primary'><FileSearch className='h-5 w-5' /></div>
                      <div>
                          <DialogTitle className="text-base md:text-lg">Historical Snapshot</DialogTitle>
                          <DialogDescription className="text-[10px] md:text-xs">Audit record from <ClientDate date={viewingHistoryRecord?.timestamp || ''} /></DialogDescription>
                      </div>
                  </div>
              </DialogHeader>
              <div className='flex-1 overflow-y-auto px-4 md:px-6 py-4'>
                  <div className="space-y-4">
                      <div className='bg-muted/30 p-3 md:p-4 rounded-lg border border-dashed text-center space-y-1'>
                          <p className='text-[10px] font-black uppercase text-muted-foreground tracking-widest'>Snapshot Context</p>
                          <p className='text-xs md:text-sm font-medium'>"{viewingHistoryRecord?.summary}"</p>
                          <div className='flex flex-wrap justify-center gap-2 mt-2'>
                              <Badge variant="secondary" className='bg-background text-[10px]'>{viewingHistoryRecord?.closedCount} / {viewingHistoryRecord?.totalCount} Fixed</Badge>
                              <Badge variant="outline" className='bg-background text-[10px] truncate max-w-[150px]'>User: {viewingHistoryRecord?.updatedBy}</Badge>
                          </div>
                      </div>
                      <div className="space-y-3 pt-2 pb-10">
                          {viewingHistoryRecord?.items.map((histItem) => {
                              const sub = subContractors.find(s => s.id === histItem.subContractorId);
                              return (
                                  <div key={histItem.id} className="p-3 border rounded-lg bg-background shadow-sm space-y-3">
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-2.5 min-w-0">
                                              {histItem.status === 'closed' ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                                              <div className='flex flex-col min-w-0'>
                                                  <span className={cn("text-xs md:text-sm font-semibold", histItem.status === 'closed' && "line-through text-muted-foreground")}>{histItem.description}</span>
                                                  {sub && <span className="text-[9px] font-bold text-primary uppercase tracking-tight truncate">{sub.name}</span>}
                                              </div>
                                          </div>
                                          <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[8px] md:text-[9px] uppercase font-bold h-4 px-1 whitespace-nowrap shrink-0'>{histItem.status}</Badge>
                                      </div>
                                      {(histItem.photos && histItem.photos.length > 0) || (histItem.completionPhotos && histItem.completionPhotos.length > 0) ? (
                                          <div className='pl-6 flex flex-wrap gap-1.5 pt-1 border-t border-dashed'>
                                              {histItem.photos?.map((p, pi) => <div key={`h-p-${pi}`} className='relative w-10 h-8 md:w-12 md:h-10 rounded border overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}><Image src={p.url} alt="Snap" fill className='object-cover' /></div>)}
                                              {histItem.completionPhotos?.map((p, pi) => <div key={`h-c-${pi}`} className='relative w-10 h-8 md:w-12 md:h-10 rounded border-2 border-green-200 overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}><Image src={p.url} alt="Fix" fill className='object-cover' /></div>)}
                                          </div>
                                      ) : null}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
              <DialogFooter className='p-4 md:p-6 bg-muted/10 border-t shrink-0'>
                  <Button variant="outline" className='w-full font-bold h-11' onClick={() => setViewingHistoryRecord(null)}>Close Audit Log</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
