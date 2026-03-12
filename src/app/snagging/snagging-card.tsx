'use client';

import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, SnaggingHistoryRecord, DistributionUser } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  ListChecks, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  User, 
  Upload, 
  X, 
  AlertTriangle, 
  Maximize2, 
  ExternalLink, 
  RefreshCw, 
  History, 
  Check,
  Eye,
  FileSearch,
  Loader2,
  MapPin,
  ClipboardCheck,
  Undo2,
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
import { ClientDate } from '@/components/client-date';
import { cn } from '@/lib/utils';
import { useTransition, useState, useRef, useEffect } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, deleteDoc, collection, addDoc, query, orderBy } from 'firebase/firestore';
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
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ImageLightbox } from '@/components/image-lightbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { Textarea } from '@/components/ui/textarea';

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
  const { user: sessionUser } = useUser();

  // Profile check for permissions
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const isInternal = profile?.userType === 'internal' || !!profile?.permissions?.hasFullVisibility;

  // Version History Fetching
  const historyQuery = useMemoFirebase(() => {
    if (!db || !item.id) return null;
    return query(collection(db, 'snagging-items', item.id, 'history'), orderBy('timestamp', 'desc'));
  }, [db, item.id]);
  const { data: history } = useCollection<SnaggingHistoryRecord>(historyQuery);

  // Snapshot Viewer State
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<SnaggingHistoryRecord | null>(null);

  // Lightbox State
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Completion Dialog State
  const [completingItem, setCompletingItem] = useState<SnaggingListItem | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<Photo[]>([]);
  const [completionComment, setCompletionComment] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen) getCameraPermission();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;

      // Robust check for active video content
      if (video.videoWidth === 0 || video.videoHeight === 0) return null;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const now = new Date();
      const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      context.font = 'bold 24px sans-serif';
      context.fillStyle = 'white';
      context.shadowColor = 'black';
      context.shadowBlur = 6;
      context.fillText(timestamp, canvas.width - context.measureText(timestamp).width - 20, canvas.height - 20);
      
      return { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: now.toISOString() };
    }
    return null;
  };

  const handleToggleStatus = (subItem: SnaggingListItem) => {
    if (subItem.status === 'open') {
      // Trade partner reporting completion
      setCompletingItem(subItem);
      setCompletionPhotos([]);
      setCompletionComment('');
      setIsCameraOpen(false);
    } else if (subItem.status === 'provisionally-complete' && isInternal) {
      // Site team signing off
      updateItemOnServer(subItem.id, 'closed', subItem.completionPhotos || [], subItem.subContractorComment);
    } else if (isInternal) {
      // Site team reopening
      updateItemOnServer(subItem.id, 'open', [], '');
    }
  };

  const updateItemOnServer = (itemId: string, status: SnaggingListItem['status'], photos: Photo[], comment?: string) => {
    startTransition(async () => {
      try {
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/completions/${item.id}-${itemId}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const updatedItems = item.items.map(i => {
          if (i.id === itemId) {
            const updates: any = { 
              ...i, 
              status,
              subContractorComment: comment || null
            };
            if (status === 'closed') {
              updates.closedAt = new Date().toISOString();
            } else if (status === 'provisionally-complete') {
              updates.provisionallyCompletedAt = new Date().toISOString();
              updates.completionPhotos = uploadedPhotos;
            } else {
              updates.completionPhotos = [];
              updates.subContractorComment = null;
            }
            return updates;
          }
          return i;
        });
        
        const docRef = doc(db, 'snagging-items', item.id);
        await updateDoc(docRef, { items: updatedItems });

        // Record Version Snapshot
        const historyCol = collection(db, 'snagging-items', item.id, 'history');
        const closedCount = updatedItems.filter(i => i.status === 'closed').length;
        await addDoc(historyCol, {
          timestamp: new Date().toISOString(),
          updatedBy: profile?.name || 'System User', 
          items: updatedItems,
          totalCount: updatedItems.length,
          closedCount,
          summary: `Item ${status.replace('-', ' ')}: ${item.items.find(i => i.id === itemId)?.description}`
        });

        toast({ title: 'Success', description: `Item is now ${status.replace('-', ' ')}.` });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update item.', variant: 'destructive' });
      }
    });
  };

  const finalizeCompletion = () => {
    if (completingItem) {
      updateItemOnServer(completingItem.id, 'provisionally-complete', completionPhotos, completionComment);
      setCompletingItem(null);
    }
  };

  const handleReopen = (subItem: SnaggingListItem) => {
    updateItemOnServer(subItem.id, 'open', [], '');
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

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
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
            <div className="flex items-center gap-1 md:gap-2">
              <Badge variant={isComplete ? "secondary" : "outline"} className="capitalize text-[9px] md:text-[10px] font-bold px-1.5 md:px-2.5 h-5 md:h-6 whitespace-nowrap">
                  {isComplete ? "Ready" : `${closedItems}/${totalItems}`}
              </Badge>
              
              <div className="hidden sm:flex items-center gap-1">
                <PdfReportButton 
                    item={item} 
                    project={project} 
                    subContractors={subContractors} 
                />
                <DistributeReportsButton
                    item={item}
                    project={project}
                    subContractors={subContractors}
                />
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
                    <AlertDialogDescription>
                      This will permanently remove this entire list. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteList} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          {item.description && <p className="text-xs md:text-sm text-foreground mb-4 leading-relaxed line-clamp-3 md:line-clamp-none">{item.description}</p>}
          
          <div className="space-y-3 mb-4 bg-muted/20 p-3 md:p-4 rounded-lg border shadow-inner">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 md:mb-2">
                  <ListChecks className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  <span>Trade Verification</span>
              </div>
              {item.items?.map((subItem) => {
                  const sub = subContractors.find(s => s.id === subItem.subContractorId);
                  
                  return (
                      <div key={subItem.id} className="space-y-2 p-2.5 md:p-3 rounded-lg bg-background border shadow-sm group">
                          <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                  <div className="mt-0.5 flex-shrink-0">
                                      {subItem.status === 'closed' ? (
                                          <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                                      ) : subItem.status === 'provisionally-complete' ? (
                                          <Clock className="h-4 w-4 md:h-5 md:w-5 text-amber-500 animate-pulse" />
                                      ) : (
                                          <Circle className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                                      )}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                      <span className={cn("text-xs md:text-sm font-semibold leading-snug break-words", subItem.status === 'closed' && "line-through text-muted-foreground")}>
                                          {subItem.description}
                                      </span>
                                      {sub && (
                                          <Badge variant="secondary" className="w-fit text-[8px] md:text-[9px] mt-1 gap-1 font-bold bg-primary/10 text-primary border-primary/20 h-4 truncate max-w-[120px] md:max-w-none">
                                              <User className="h-2 w-2" /> {sub.name}
                                          </Badge>
                                      )}
                                  </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <Badge variant="outline" className={cn(
                                      "text-[8px] md:text-[9px] font-black uppercase tracking-tighter h-4 px-1.5 whitespace-nowrap",
                                      subItem.status === 'closed' ? "bg-green-50 text-green-700 border-green-200" :
                                      subItem.status === 'provisionally-complete' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground"
                                  )}>
                                      {subItem.status.replace('-', ' ')}
                                  </Badge>
                                  
                                  <div className="flex flex-wrap gap-1 justify-end">
                                      {subItem.status === 'open' && (
                                          <Button size="sm" variant="outline" className="h-6 text-[9px] font-bold px-2" onClick={() => handleToggleStatus(subItem)} disabled={isPending}>
                                              Update
                                          </Button>
                                      )}
                                      {subItem.status === 'provisionally-complete' && isInternal && (
                                          <>
                                              <Button size="sm" className="h-6 text-[9px] font-bold bg-green-600 hover:bg-green-700 gap-1 px-2" onClick={() => handleToggleStatus(subItem)} disabled={isPending}>
                                                  <Check className="h-3 w-3" /> Sign-off
                                              </Button>
                                              <Button size="sm" variant="outline" className="h-6 text-[9px] font-bold text-destructive hover:bg-destructive/5 gap-1 px-2" onClick={() => handleReopen(subItem)} disabled={isPending}>
                                                  Reject
                                              </Button>
                                          </>
                                      )}
                                      {subItem.status === 'closed' && isInternal && (
                                          <Button size="sm" variant="ghost" className="h-6 text-[9px] font-bold text-muted-foreground hover:text-primary px-2" onClick={() => handleReopen(subItem)} disabled={isPending}>
                                              Re-open
                                          </Button>
                                      )}
                                  </div>
                              </div>
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

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="history">
                <AccordionTrigger className="text-xs md:text-sm font-semibold">
                    <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                        <span>Version History ({history?.length || 0})</span>
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
              <AccordionItem value="photo">
                <AccordionTrigger className="text-xs md:text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    <span>Visual Assets ({item.photos.length})</span>
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
                                  <Image
                                  src={photo.url}
                                  alt={`Defect asset ${index + 1}`}
                                  width={600}
                                  height={400}
                                  className="rounded-md border object-cover aspect-video"
                                  data-ai-hint="construction defect"
                                  />
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

      {/* Completion Evidence Dialog */}
      <Dialog open={!!completingItem} onOpenChange={() => setCompletingItem(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-xl p-4 md:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg">Report Progress</DialogTitle>
            <DialogDescription className="text-xs">
              Provide evidence for: <span className="font-bold text-foreground">"{completingItem?.description}"</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5">
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Completion Notes</Label>
                <Textarea 
                  placeholder="Describe the fix or action taken..." 
                  value={completionComment}
                  onChange={(e) => setCompletionComment(e.target.value)}
                  className="text-sm min-h-[80px]"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Visual Evidence</Label>
                <div className="flex flex-wrap gap-2">
                  {completionPhotos.map((p, idx) => (
                    <div key={idx} className="relative w-20 h-20 group">
                      <Image src={p.url} alt="Evidence" fill className="rounded-md object-cover border" />
                      <button type="button" className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg" onClick={() => setCompletionPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <Button variant="outline" className="w-20 h-20 flex flex-col gap-1.5 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="h-6 w-6 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Capture</span>
                  </Button>
                  <Button variant="outline" className="w-20 h-20 flex flex-col gap-1.5 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-6 w-6 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Upload</span>
                  </Button>
                </div>
            </div>

            {isCameraOpen && (
              <div className="fixed inset-0 z-[100] bg-black">
                {hasCameraPermission === false && (
                  <div className="absolute top-20 left-6 right-6 z-[110]">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Microphone Access Required</AlertTitle>
                      <AlertDescription>Please enable camera access in your settings to capture verification photos.</AlertDescription>
                    </Alert>
                  </div>
                )}
                
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  <div className="flex justify-end">
                    <Button 
                      variant="secondary" 
                      onClick={() => setIsCameraOpen(false)} 
                      className="rounded-full h-12 px-6 font-bold shadow-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-center gap-8 mb-8">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="rounded-full h-14 w-14 shadow-lg" 
                      onClick={toggleCamera} 
                      title="Switch"
                    >
                      <RefreshCw className="h-7 w-7" />
                    </Button>
                    
                    <Button 
                      size="lg" 
                      className="rounded-full h-20 w-20 p-0 border-4 border-white/20 shadow-2xl bg-white hover:bg-white/90"
                      onClick={() => {
                        const p = capturePhoto();
                        if (p) {
                          setCompletionPhotos(prev => [...prev, p]);
                          setIsCameraOpen(false);
                        }
                      }}
                    >
                      <div className="h-14 w-14 rounded-full border-2 border-black/10" />
                    </Button>
                    
                    <div className="w-14" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 sm:gap-0 border-t pt-5 mt-2">
            <Button variant="ghost" className="font-bold text-muted-foreground sm:order-first" onClick={() => setCompletingItem(null)}>Discard</Button>
            <Button className="font-bold shadow-lg shadow-primary/20 flex-1 sm:flex-none h-11" onClick={finalizeCompletion} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4 mr-2" />}
                Post Verification
            </Button>
          </DialogFooter>
          
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
            const files = e.target.files;
            if (!files) return;
            Array.from(files).forEach(f => {
              const reader = new FileReader();
              reader.onload = (re) => setCompletionPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
              reader.readAsDataURL(f);
            });
          }} />
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>

      {/* Audit Snapshot Viewer */}
      <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl shadow-2xl">
              <DialogHeader className="p-4 md:p-6 pb-0 shrink-0">
                  <div className='flex items-center gap-3 mb-1'>
                      <div className='bg-primary/10 p-2 rounded-lg text-primary'>
                          <FileSearch className='h-5 w-5' />
                      </div>
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
                                              {histItem.status === 'closed' ? (
                                                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                              ) : (
                                                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                              )}
                                              <div className='flex flex-col min-w-0'>
                                                  <span className={cn("text-xs md:text-sm font-semibold leading-snug break-words", histItem.status === 'closed' && "line-through text-muted-foreground")}>
                                                      {histItem.description}
                                                  </span>
                                                  {sub && <span className="text-[9px] font-bold text-primary uppercase tracking-tight truncate">{sub.name}</span>}
                                              </div>
                                          </div>
                                          <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[8px] md:text-[9px] uppercase font-bold h-4 px-1 whitespace-nowrap shrink-0'>
                                              {histItem.status}
                                          </Badge>
                                      </div>

                                      {(histItem.photos && histItem.photos.length > 0) || (histItem.completionPhotos && histItem.completionPhotos.length > 0) ? (
                                          <div className='pl-6 flex flex-wrap gap-1.5 pt-1 border-t border-dashed'>
                                              {histItem.photos?.map((p, pi) => (
                                                  <div key={`hist-p-${pi}`} className='relative w-10 h-8 md:w-12 md:h-10 rounded border overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                      <Image src={p.url} alt="Snap" fill className='object-cover' />
                                                  </div>
                                              ))}
                                              {histItem.completionPhotos?.map((p, pi) => (
                                                  <div key={`hist-c-${pi}`} className='relative w-10 h-8 md:w-12 md:h-10 rounded border-2 border-green-200 overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                      <Image src={p.url} alt="Fix" fill className='object-cover' />
                                                  </div>
                                              ))}
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
