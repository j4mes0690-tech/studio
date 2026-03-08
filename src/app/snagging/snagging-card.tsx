'use client';

import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, SnaggingHistoryRecord } from '@/lib/types';
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
  FileSearch
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
      setCompletingItem(subItem);
      setCompletionPhotos([]);
      setIsCameraOpen(false);
    } else {
      updateItemOnServer(subItem.id, 'open', []);
    }
  };

  const updateItemOnServer = (itemId: string, status: 'open' | 'closed', photos: Photo[]) => {
    startTransition(async () => {
      const updatedItems = item.items.map(i => {
        if (i.id === itemId) {
          return { 
            ...i, 
            status, 
            completionPhotos: status === 'closed' ? photos : [],
            subContractorId: i.subContractorId || null,
            photos: i.photos || []
          };
        }
        return {
          ...i,
          subContractorId: i.subContractorId || null,
          photos: i.photos || [],
          completionPhotos: i.completionPhotos || []
        };
      });
      
      const docRef = doc(db, 'snagging-items', item.id);
      
      // Update Main Document
      await updateDoc(docRef, { items: updatedItems })
        .catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { items: updatedItems },
          }));
        });

      // Record Version History Snapshot
      const historyCol = collection(db, 'snagging-items', item.id, 'history');
      const closed = updatedItems.filter(i => i.status === 'closed').length;
      const historyData = {
        timestamp: new Date().toISOString(),
        updatedBy: 'System User', 
        items: updatedItems,
        totalCount: updatedItems.length,
        closedCount: closed,
        summary: status === 'closed' ? `Item marked complete: ${item.items.find(i => i.id === itemId)?.description}` : `Item reopened: ${item.items.find(i => i.id === itemId)?.description}`
      };
      
      await addDoc(historyCol, historyData).catch(() => {});
    });
  };

  const finalizeCompletion = () => {
    if (completingItem) {
      updateItemOnServer(completingItem.id, 'closed', completionPhotos);
      setCompletingItem(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
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
    <>
      <Card className={cn("transition-colors hover:border-primary/50 shadow-md", isComplete && "bg-muted/30")}>
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
                    <span>{area.name}</span>
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
                  {isComplete ? "Handover Ready" : `${closedItems}/${totalItems} Verified`}
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
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : null}
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
                  return (
                      <div key={subItem.id} className="space-y-2 group">
                          <div className="flex items-start gap-2">
                              <button 
                                  onClick={() => handleToggleStatus(subItem)}
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
                                  <span className={cn("text-sm font-medium", subItem.status === 'closed' && "line-through text-muted-foreground")}>
                                      {subItem.description}
                                  </span>
                                  {sub && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-auto font-bold gap-1 bg-primary/10 text-primary border-primary/20">
                                              <User className="h-2 w-2" />
                                              {sub.name}
                                          </Badge>
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          {/* Photos Section */}
                          {(subItem.photos && subItem.photos.length > 0) || (subItem.completionPhotos && subItem.completionPhotos.length > 0) ? (
                            <div className="pl-6 space-y-2">
                              {subItem.photos && subItem.photos.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {subItem.photos.map((p, idx) => (
                                    <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                      <Image src={p.url} alt="Defect" fill className="object-cover" />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Maximize2 className="h-4 w-4 text-white" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {subItem.completionPhotos && subItem.completionPhotos.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[9px] font-black text-green-600 uppercase tracking-tighter">Completion Evidence</p>
                                  <div className="flex flex-wrap gap-2">
                                    {subItem.completionPhotos.map((p, idx) => (
                                      <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity rounded border border-green-200 bg-background overflow-hidden group" onClick={() => setViewingPhoto(p)}>
                                        <Image src={p.url} alt="Fixed" fill className="object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Maximize2 className="h-4 w-4 text-white" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                      </div>
                  );
              })}
          </div>

          <Accordion type="single" collapsible className="w-full">
            {/* Version History Section */}
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
                                                <Eye className="h-3 w-3 text-primary opacity-0 group-hover/hist:opacity-100 transition-opacity" />
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

        {/* Completion Dialog */}
        <Dialog open={!!completingItem} onOpenChange={() => setCompletingItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Item as Verified</DialogTitle>
              <DialogDescription>
                Confirm completion for: "{completingItem?.description}"
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Add completion evidence to the version history (Optional):</p>
              
              <div className="flex flex-wrap gap-2">
                {completionPhotos.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 group">
                    <Image src={p.url} alt="Fixed" fill className="rounded-md object-cover border" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg" onClick={() => setCompletionPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
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

              {isCameraOpen && (
                <div className="space-y-3 border-2 border-primary/20 rounded-xl p-3 bg-primary/5 mt-4">
                  {hasCameraPermission === false && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Access Denied</AlertTitle>
                      <AlertDescription>Enable camera permissions to capture evidence.</AlertDescription>
                    </Alert>
                  )}
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden ring-4 ring-white shadow-xl">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button size="lg" className="h-12 px-8 font-bold" onClick={() => {
                      const p = capturePhoto();
                      if (p) {
                        setCompletionPhotos(prev => [...prev, p]);
                        setIsCameraOpen(false);
                      }
                    }}>Capture Frame</Button>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={toggleCamera} title="Switch Camera">
                      <RefreshCw className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" onClick={() => setIsCameraOpen(false)} className="h-12 font-bold text-muted-foreground">Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
              <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setCompletingItem(null)}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="font-bold border-2" onClick={() => { setCompletionPhotos([]); finalizeCompletion(); }}>Skip & Complete</Button>
                <Button className="font-bold shadow-lg shadow-primary/20" onClick={finalizeCompletion} disabled={completionPhotos.length === 0 && !isCameraOpen}>Commit & Close Item</Button>
              </div>
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

        {/* Snapshot Viewer Dialog */}
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
    </>
  );
}
