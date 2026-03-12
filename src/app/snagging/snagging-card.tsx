
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
  Undo2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
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
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          }));
        });
    });
  };

  return (
    <>
      <Card className="transition-all hover:bg-muted/5 hover:border-primary/50 shadow-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <Link href={`/snagging/${item.id}`} className="space-y-1 flex-1 group">
              <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors text-lg">
                {item.title}
                {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
              <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="font-semibold text-foreground">{project?.name || 'Unknown Project'}</span>
                {area && (
                  <>
                    <span className="text-muted-foreground">&gt;</span>
                    <span className="flex items-center gap-1 font-bold text-primary">
                      <MapPin className="h-3 w-3" />
                      {area.name}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground/80 font-medium">
                  Logged <ClientDate date={item.createdAt} />
                </span>
              </CardDescription>
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? "secondary" : "outline"} className="capitalize text-[10px] font-bold">
                  {isComplete ? "Handover Ready" : `${closedItems}/${totalItems} Sign-offs`}
              </Badge>
              
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
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {item.description && <p className="text-sm text-foreground mb-4 leading-relaxed">{item.description}</p>}
          
          <div className="space-y-4 mb-6 bg-muted/20 p-4 rounded-lg border shadow-inner">
              <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <span>Trade Verification Points</span>
              </div>
              {item.items?.map((subItem) => {
                  const sub = subContractors.find(s => s.id === subItem.subContractorId);
                  const isAwaitingSignOff = subItem.status === 'provisionally-complete';
                  
                  return (
                      <div key={subItem.id} className="space-y-3 p-3 rounded-lg bg-background border shadow-sm group">
                          <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex-shrink-0">
                                      {subItem.status === 'closed' ? (
                                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                                      ) : subItem.status === 'provisionally-complete' ? (
                                          <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                                      ) : (
                                          <Circle className="h-5 w-5 text-muted-foreground" />
                                      )}
                                  </div>
                                  <div className="flex flex-col">
                                      <span className={cn("text-sm font-semibold", subItem.status === 'closed' && "line-through text-muted-foreground")}>
                                          {subItem.description}
                                      </span>
                                      {sub && (
                                          <Badge variant="secondary" className="w-fit text-[9px] mt-1 gap-1 font-bold bg-primary/10 text-primary border-primary/20">
                                              <User className="h-2 w-2" /> {sub.name}
                                          </Badge>
                                      )}
                                  </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                  <Badge variant="outline" className={cn(
                                      "text-[9px] font-black uppercase tracking-tighter",
                                      subItem.status === 'closed' ? "bg-green-50 text-green-700 border-green-200" :
                                      subItem.status === 'provisionally-complete' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground"
                                  )}>
                                      {subItem.status.replace('-', ' ')}
                                  </Badge>
                                  
                                  <div className="flex gap-1">
                                      {subItem.status === 'open' && (
                                          <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold" onClick={() => handleToggleStatus(subItem)} disabled={isPending}>
                                              Update Progress
                                          </Button>
                                      )}
                                      {subItem.status === 'provisionally-complete' && isInternal && (
                                          <>
                                              <Button size="sm" className="h-7 text-[10px] font-bold bg-green-600 hover:bg-green-700 gap-1" onClick={() => handleToggleStatus(subItem)} disabled={isPending}>
                                                  <ClipboardCheck className="h-3 w-3" /> Sign-off
                                              </Button>
                                              <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold text-destructive hover:bg-destructive/5 gap-1" onClick={() => handleReopen(subItem)} disabled={isPending}>
                                                  <Undo2 className="h-3 w-3" /> Reject
                                              </Button>
                                          </>
                                      )}
                                      {subItem.status === 'closed' && isInternal && (
                                          <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-muted-foreground hover:text-primary" onClick={() => handleReopen(subItem)} disabled={isPending}>
                                              Re-open
                                          </Button>
                                      )}
                                  </div>
                              </div>
                          </div>
                          
                          {subItem.subContractorComment && (
                              <div className="ml-8 p-2 rounded bg-muted/30 border-l-2 border-primary/20 text-xs italic text-muted-foreground">
                                  "{subItem.subContractorComment}"
                              </div>
                          )}

                          {(subItem.photos && subItem.photos.length > 0) || (subItem.completionPhotos && subItem.completionPhotos.length > 0) ? (
                            <div className="pl-8 flex flex-wrap gap-2">
                              {subItem.photos?.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                  <Image src={p.url} alt="Defect" fill className="object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                              ))}
                              {subItem.completionPhotos?.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border-2 border-green-200 bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                  <Image src={p.url} alt="Fixed" fill className="object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="h-4 w-4 text-white" />
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
                <AccordionTrigger className="text-sm font-semibold">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <span>Audit & Version History ({history?.length || 0})</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                    <ScrollArea className="h-48 rounded-md border bg-muted/5 p-4">
                        <div className="space-y-4">
                            {history && history.length > 0 ? history.map((record, idx) => (
                                <div 
                                    key={record.id} 
                                    className="relative pl-4 border-l-2 border-primary/20 pb-2 last:pb-0 cursor-pointer group/hist transition-colors hover:bg-primary/5 rounded-r-md"
                                    onClick={() => setViewingHistoryRecord(record)}
                                >
                                    <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <div className='flex items-center gap-2'>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Version {history.length - idx}</span>
                                                {idx === 0 && (
                                                  <Badge variant="secondary" className="h-4 px-1.5 text-[8px] bg-green-100 text-green-800 border-green-200 font-black">
                                                    CURRENT
                                                  </Badge>
                                                )}
                                                <Eye className="h-3 w-3 text-primary group-hover/hist:text-primary transition-colors" />
                                            </div>
                                            <span className="text-[9px] text-muted-foreground"><ClientDate date={record.timestamp} /></span>
                                        </div>
                                        <p className="text-xs font-medium text-foreground">{record.summary}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-bold border-green-200 bg-green-50 text-green-700">
                                                <Check className="h-2 w-2 mr-1" /> {record.closedCount} / {record.totalCount} Done
                                            </Badge>
                                            <span className="text-[9px] text-muted-foreground font-medium">Updated by: {record.updatedBy}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-center text-muted-foreground py-8 italic">No version snapshots recorded yet.</p>
                            )}
                        </div>
                    </ScrollArea>
                </AccordionContent>
            </AccordionItem>

            {item.photos && item.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>Reference Documentation ({item.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>
                      {item.photos.map((photo, index) => (
                        <CarouselItem key={index}>
                          <div className="p-1">
                             <div className="space-y-2">
                              <div className="relative cursor-pointer hover:opacity-95 transition-opacity group" onClick={() => setViewingPhoto(photo)}>
                                  <Image
                                  src={photo.url}
                                  alt={`Snagging item photo ${index + 1}`}
                                  width={600}
                                  height={400}
                                  className="rounded-md border object-cover aspect-video"
                                  data-ai-hint="construction defect"
                                  />
                                  <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 className="h-4 w-4 text-white" />
                                  </div>
                              </div>
                              <p className="text-xs text-muted-foreground text-center font-medium">
                                Captured: <ClientDate date={photo.takenAt} />
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

        <Dialog open={!!completingItem} onOpenChange={() => setCompletingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Completion Evidence</DialogTitle>
              <DialogDescription>
                Confirm your work for: "{completingItem?.description}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                  <Label>Completion Notes</Label>
                  <Textarea 
                    placeholder="Describe the fix or action taken..." 
                    value={completionComment}
                    onChange={(e) => setCompletionComment(e.target.value)}
                  />
              </div>

              <div className="space-y-2">
                  <Label>Photo Evidence</Label>
                  <div className="flex flex-wrap gap-2">
                    {completionPhotos.map((p, idx) => (
                      <div key={idx} className="relative w-20 h-20 group">
                        <Image src={p.url} alt="Fixed" fill className="rounded-md object-cover border" />
                        <button type="button" className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg" onClick={() => setCompletionPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed hover:bg-muted/50" onClick={() => setIsCameraOpen(true)}>
                      <Camera className="h-6 w-6 text-primary" />
                      <span className="text-[10px] font-bold uppercase">Camera</span>
                    </Button>
                    <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed hover:bg-muted/50" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-6 w-6 text-primary" />
                      <span className="text-[10px] font-bold uppercase">Upload</span>
                    </Button>
                  </div>
              </div>

              {isCameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black">
                  {hasCameraPermission === false && (
                    <div className="absolute top-20 left-6 right-6 z-[110]">
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>Enable camera permissions to capture evidence.</AlertDescription>
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
                        title="Switch Camera"
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

            <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
              <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setCompletingItem(null)}>Cancel</Button>
              <Button className="font-bold shadow-lg shadow-primary/20" onClick={finalizeCompletion} disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit for Approval
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

        <Dialog open={!!viewingHistoryRecord} onOpenChange={() => setViewingHistoryRecord(null)}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0 shrink-0">
                    <div className='flex items-center gap-3 mb-1'>
                        <div className='bg-primary/10 p-2 rounded-lg'>
                            <FileSearch className='h-5 w-5 text-primary' />
                        </div>
                        <div>
                            <DialogTitle>Historical Snapshot</DialogTitle>
                            <DialogDescription>Captured on <ClientDate date={viewingHistoryRecord?.timestamp || ''} /></DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                
                <div className='flex-1 overflow-y-auto px-6 py-4'>
                    <div className="space-y-4">
                        <div className='bg-muted/30 p-4 rounded-lg border border-dashed text-center space-y-1'>
                            <p className='text-[10px] font-black uppercase text-muted-foreground tracking-widest'>Audit Summary</p>
                            <p className='text-sm font-medium'>"{viewingHistoryRecord?.summary}"</p>
                            <div className='flex justify-center gap-2 mt-2'>
                                <Badge variant="secondary" className='bg-background'>{viewingHistoryRecord?.closedCount} / {viewingHistoryRecord?.totalCount} Fixed</Badge>
                                <Badge variant="outline" className='bg-background'>Authored by: {viewingHistoryRecord?.updatedBy}</Badge>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest px-1'>Point-in-Time Status</p>
                            {viewingHistoryRecord?.items.map((histItem) => {
                                const sub = subContractors.find(s => s.id === histItem.subContractorId);
                                return (
                                    <div key={histItem.id} className="p-3 border rounded-lg bg-background shadow-sm space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                {histItem.status === 'closed' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                )}
                                                <div className='flex flex-col gap-1'>
                                                    <span className={cn("text-sm font-semibold", histItem.status === 'closed' && "line-through text-muted-foreground")}>
                                                        {histItem.description}
                                                    </span>
                                                    {sub && <span className="text-[10px] font-bold text-primary uppercase">{sub.name}</span>}
                                                </div>
                                            </div>
                                            <Badge variant={histItem.status === 'closed' ? "secondary" : "outline"} className='text-[9px] uppercase font-bold h-5'>
                                                {histItem.status}
                                            </Badge>
                                        </div>

                                        {(histItem.photos && histItem.photos.length > 0) || (histItem.completionPhotos && histItem.completionPhotos.length > 0) ? (
                                            <div className='pl-7 flex flex-wrap gap-2 pt-1 border-t border-dashed'>
                                                {histItem.photos?.map((p, pi) => (
                                                    <div key={`hist-p-${pi}`} className='relative w-12 h-10 rounded border overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                        <Image src={p.url} alt="Snap" fill className='object-cover' />
                                                    </div>
                                                ))}
                                                {histItem.completionPhotos?.map((p, pi) => (
                                                    <div key={`hist-c-${pi}`} className='relative w-12 h-10 rounded border-2 border-green-200 overflow-hidden cursor-pointer' onClick={() => setViewingPhoto(p)}>
                                                        <Image src={p.url} alt="Fix Snap" fill className='object-cover' />
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

                <DialogFooter className='p-6 bg-muted/10 border-t shrink-0'>
                    <Button variant="outline" className='w-full' onClick={() => setViewingHistoryRecord(null)}>Close Auditor</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
