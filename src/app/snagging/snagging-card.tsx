
'use client';

import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo } from '@/lib/types';
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
import { Camera, ListChecks, CheckCircle2, Circle, Trash2, User, Upload, X, AlertTriangle, Maximize2, ExternalLink } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  // Lightbox State
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Completion Dialog State
  const [completingItem, setCompletingItem] = useState<SnaggingListItem | null>(null);
  const [completionPhotos, setCompletionPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
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
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 800;
      canvas.height = 800 / aspectRatio;
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
      const updatedItems = item.items.map(i => 
        i.id === itemId ? { 
          ...i, 
          status, 
          completionPhotos: status === 'closed' ? photos : [] 
        } : i
      );
      const docRef = doc(db, 'snagging-items', item.id);
      updateDoc(docRef, { items: updatedItems })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { items: updatedItems },
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const finalizeCompletion = () => {
    if (completingItem) {
      updateItemOnServer(completingItem.id, 'closed', completionPhotos);
      setCompletingItem(null);
    }
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
    <Card className={cn("transition-colors hover:border-primary/50", isComplete && "bg-muted/30")}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <Link href={`/snagging/${item.id}`} className="space-y-1 flex-1 group">
            <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
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
              <span className="text-xs text-muted-foreground/80">
                Logged <ClientDate date={item.createdAt} />
              </span>
            </CardDescription>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={isComplete ? "secondary" : "outline"} className="capitalize">
                {isComplete ? "Completed" : `${closedItems}/${totalItems} Done`}
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
                                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-auto font-normal gap-1">
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
                                  <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingPhoto(p)}>
                                    <Image src={p.url} alt="Defect" fill className="rounded object-cover border" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded">
                                        <Maximize2 className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {subItem.completionPhotos && subItem.completionPhotos.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-green-600 uppercase tracking-tighter">Completion Visual</p>
                                <div className="flex flex-wrap gap-2">
                                  {subItem.completionPhotos.map((p, idx) => (
                                    <div key={idx} className="relative w-16 h-12 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setViewingPhoto(p)}>
                                      <Image src={p.url} alt="Fixed" fill className="rounded object-cover border border-green-200" />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded">
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
                            <div className="relative cursor-pointer hover:opacity-95 transition-opacity" onClick={() => setViewingPhoto(photo)}>
                                <Image
                                src={photo.url}
                                alt={`Snagging item photo ${index + 1}`}
                                width={600}
                                height={400}
                                className="rounded-md border object-cover aspect-video"
                                data-ai-hint="construction defect"
                                />
                                <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white">
                                    <Maximize2 className="h-4 w-4" />
                                </div>
                            </div>
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

      {/* Lightbox Dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={(open) => !open && setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
            <DialogHeader className="sr-only">
                <DialogTitle>View Photo</DialogTitle>
            </DialogHeader>
            {viewingPhoto && (
                <div className="relative w-full aspect-video md:aspect-[16/10] flex items-center justify-center">
                    <Image 
                        src={viewingPhoto.url} 
                        alt="Site Photo Full" 
                        fill 
                        className="object-contain"
                        priority
                    />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-white/80 text-xs bg-black/40 backdrop-blur-sm p-3 rounded-lg border border-white/10">
                        <span className="font-medium">Site Documentation</span>
                        <div className="flex items-center gap-2">
                            <span>Captured:</span>
                            <ClientDate date={viewingPhoto.takenAt} />
                        </div>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-4 right-4 text-white hover:bg-white/20" 
                        onClick={() => setViewingPhoto(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* Completion Dialog */}
      <Dialog open={!!completingItem} onOpenChange={() => setCompletingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Item as Complete</DialogTitle>
            <DialogDescription>
              "{completingItem?.description}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Add a photo to document the completed work (Optional):</p>
            
            <div className="flex flex-wrap gap-2">
              {completionPhotos.map((p, idx) => (
                <div key={idx} className="relative w-20 h-20">
                  <Image src={p.url} alt="Fixed" fill className="rounded-md object-cover border" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setCompletionPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
              <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => setIsCameraOpen(true)}>
                <Camera className="h-6 w-6" />
                <span className="text-[10px]">Photo</span>
              </Button>
              <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-6 w-6" />
                <span className="text-[10px]">Upload</span>
              </Button>
            </div>

            {isCameraOpen && (
              <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                {hasCameraPermission === false && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Camera Denied</AlertTitle>
                    <AlertDescription>Please allow camera access.</AlertDescription>
                  </Alert>
                )}
                <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    const p = capturePhoto();
                    if (p) {
                      setCompletionPhotos(prev => [...prev, p]);
                      setIsCameraOpen(false);
                    }
                  }}>Capture</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCompletingItem(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => { setCompletionPhotos([]); finalizeCompletion(); }}>Skip Photo & Complete</Button>
            <Button onClick={finalizeCompletion} disabled={completionPhotos.length === 0 && !isCameraOpen}>Complete Item</Button>
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
    </Card>
  );
}
