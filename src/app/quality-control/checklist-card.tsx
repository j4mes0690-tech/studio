
'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import type { QualityChecklist, Project, ChecklistItem, ChecklistItemStatus, SubContractor, Photo } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { ClientDate } from '../../components/client-date';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Users, Trash2, Loader2, Camera, Upload, X, RefreshCw, Maximize2 } from 'lucide-react';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { DistributeChecklistButton } from './distribute-checklist-button';
import { ImageLightbox } from '@/components/image-lightbox';

type ChecklistCardProps = {
  checklist: QualityChecklist;
  projects: Project[];
  subContractors: SubContractor[];
  defaultExpanded?: boolean;
};

export function ChecklistCard({
  checklist,
  projects,
  subContractors,
  defaultExpanded = false,
}: ChecklistCardProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items);
  
  // Camera & Media State
  const [activeItemForPhoto, setActiveItemForPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(checklist.items);
  }, [checklist.items]);

  const updateItemsOnServer = (newItems: ChecklistItem[]) => {
    startTransition(async () => {
        const docRef = doc(db, 'quality-checklists', checklist.id);
        const updates = { items: newItems };
        
        updateDoc(docRef, updates)
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
            setItems(checklist.items); // Revert UI
          });
    });
  }

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'quality-checklists', checklist.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Checklist removed from area.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleStatusChange = (itemId: string, status: ChecklistItemStatus) => {
    const newItems = items.map((item) =>
      item.id === itemId ? { ...item, status } : item
    );
    setItems(newItems);
    updateItemsOnServer(newItems);
  };
  
  const handleCommentChange = (itemId: string, comment: string) => {
    const newItems = items.map((item) =>
      item.id === itemId ? { ...item, comment } : item
    );
    setItems(newItems);
  }

  const handleCommentBlur = (itemId: string) => {
    const currentItem = items.find(i => i.id === itemId);
    const originalItem = checklist.items.find(i => i.id === itemId);

    if (currentItem?.comment !== originalItem?.comment) {
      updateItemsOnServer(items);
    }
  }

  // Camera Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {}
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && activeItemForPhoto) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const newPhoto = { url: dataUrl, takenAt: new Date().toISOString() };
      
      handlePhotoUpdate(activeItemForPhoto, newPhoto);
      setIsCameraOpen(false);
      setActiveItemForPhoto(null);
    }
  };

  const handlePhotoUpdate = (itemId: string, photo: Photo) => {
    startTransition(async () => {
      try {
        toast({ title: 'Uploading', description: 'Persisting documentation...' });
        
        let url = photo.url;
        if (photo.url.startsWith('data:')) {
          const blob = await dataUriToBlob(photo.url);
          url = await uploadFile(storage, `quality-control/${checklist.id}/${itemId}-${Date.now()}.jpg`, blob);
        }

        const newItems = items.map(item => {
          if (item.id === itemId) {
            return { ...item, photos: [...(item.photos || []), { ...photo, url }] };
          }
          return item;
        });

        setItems(newItems);
        updateItemsOnServer(newItems);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to save photo.', variant: 'destructive' });
      }
    });
  };

  const removePhoto = (itemId: string, photoIdx: number) => {
    const newItems = items.map(item => {
      if (item.id === itemId) {
        return { ...item, photos: (item.photos || []).filter((_, i) => i !== photoIdx) };
      }
      return item;
    });
    setItems(newItems);
    updateItemsOnServer(newItems);
  };

  const project = projects.find((p) => p.id === checklist.projectId);
  const area = project?.areas?.find(a => a.id === checklist.areaId);

  const completedItems = items.filter((item) => item.status !== 'pending').length;
  const progress = items.length > 0 ? (completedItems / items.length) * 100 : 0;
  const hasFailure = items.some((item) => item.status === 'no');
  
  return (
    <>
      <Card className={cn(hasFailure && 'border-destructive')}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle>{checklist.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
                {project && (
                  <>
                    <span className="font-semibold text-foreground">{project.name}</span>
                    {area && (
                      <>
                        <span className="text-muted-foreground">&gt;</span>
                        <span className="font-medium">{area.name}</span>
                      </>
                    )}
                    <span className="hidden sm:inline-block text-muted-foreground">•</span>
                  </>
                )}
                <span className="text-xs text-muted-foreground/80">
                  Created <ClientDate date={checklist.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasFailure ? 'destructive' : 'secondary'}>{checklist.trade}</Badge>
              
              <DistributeChecklistButton checklist={checklist} project={project} />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete Checklist</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Assigned Checklist?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the "{checklist.title}" checklist and all its recorded evidence for this area.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
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
          <div className="space-y-2">
              <div className='flex justify-between items-center text-sm'>
                  <p className="text-muted-foreground">Verification Progress</p>
                  <p className="font-medium">{completedItems} / {items.length} Points</p>
              </div>
            <Progress value={progress} indicatorClassName={hasFailure ? 'bg-destructive' : ''} />
          </div>
          <Accordion type="single" collapsible className="w-full mt-4" defaultValue={defaultExpanded ? "items" : undefined}>
            <AccordionItem value="items">
              <AccordionTrigger className="text-sm font-semibold">
                Verification Items
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className={cn("space-y-3 p-3 rounded-md border transition-colors", item.status === 'no' ? 'border-destructive bg-destructive/5' : 'border-transparent bg-muted/10 hover:border-border')}>
                      <Label className="font-bold text-foreground text-sm leading-relaxed">{item.text}</Label>
                      
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <RadioGroup
                            value={item.status}
                            onValueChange={(status) => handleStatusChange(item.id, status as ChecklistItemStatus)}
                            className="flex items-center space-x-6"
                            disabled={isPending}
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yes" id={`${item.id}-yes`} className="text-green-600 border-green-200" />
                                <Label htmlFor={`${item.id}-yes`} className="cursor-pointer">Pass</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="no" id={`${item.id}-no`} className="text-destructive border-destructive/30" />
                                <Label htmlFor={`${item.id}-no`} className="cursor-pointer">Fail</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="na" id={`${item.id}-na`} />
                                <Label htmlFor={`${item.id}-na`} className="cursor-pointer">N/A</Label>
                            </div>
                        </RadioGroup>

                        <div className="flex gap-1">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => { setActiveItemForPhoto(item.id); setIsCameraOpen(true); }}
                            title="Take photo"
                          >
                            <Camera className="h-4 w-4" />
                            <span className="sr-only">Take photo</span>
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => { setActiveItemForPhoto(item.id); fileInputRef.current?.click(); }}
                            title="Upload photo"
                          >
                            <Upload className="h-4 w-4" />
                            <span className="sr-only">Upload photo</span>
                          </Button>
                        </div>
                      </div>

                      <Input 
                          placeholder="Trade compliance notes..."
                          value={item.comment || ''}
                          onChange={(e) => handleCommentChange(item.id, e.target.value)}
                          onBlur={() => handleCommentBlur(item.id)}
                          disabled={isPending}
                          className="text-sm bg-background"
                      />

                      {/* Item Photo Gallery */}
                      {item.photos && item.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {item.photos.map((p, idx) => (
                            <div key={idx} className="relative w-16 h-12 rounded border bg-background overflow-hidden group">
                              <Image 
                                src={p.url} 
                                alt="Inspection evidence" 
                                fill 
                                className="object-cover cursor-pointer" 
                                onClick={() => setViewingPhoto(p)}
                              />
                              <button 
                                type="button" 
                                className="absolute top-0 right-0 bg-destructive text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePhoto(item.id, idx)}
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            {checklist.recipients && checklist.recipients.length > 0 && (
               <AccordionItem value="recipients">
               <AccordionTrigger className="text-sm font-semibold">
                 <div className="flex items-center gap-2">
                   <Users className="h-4 w-4" />
                   <span>
                     Distribution List ({checklist.recipients.length})
                   </span>
                 </div>
               </AccordionTrigger>
               <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {checklist.recipients.map((email, index) => (
                    <Badge key={index} variant="outline" className="bg-background">{email}</Badge>
                  ))}
                </div>
               </AccordionContent>
             </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      {/* Item Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-lg space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-white/10 shadow-2xl">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            </div>
            <div className="flex justify-center gap-4">
              <Button size="lg" onClick={capturePhoto} className="rounded-full h-16 w-16 p-0 border-4 border-white/20">
                <div className="h-10 w-10 rounded-full bg-white" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} className="rounded-full h-12 w-12 text-white border-white/40 hover:bg-white/20">
                <RefreshCw className="h-6 w-6" />
              </Button>
              <Button variant="outline" onClick={() => { setIsCameraOpen(false); setActiveItemForPhoto(null); }} className="rounded-full h-12 px-6 border-white/40 text-white hover:bg-white/20">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Upload Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        multiple 
        onChange={(e) => {
          const files = e.target.files;
          if (!files || !activeItemForPhoto) return;
          Array.from(files).forEach(f => {
            const reader = new FileReader();
            reader.onload = (re) => {
              handlePhotoUpdate(activeItemForPhoto, { 
                url: re.target?.result as string, 
                takenAt: new Date().toISOString() 
              });
            };
            reader.readAsDataURL(f);
          });
          setActiveItemForPhoto(null);
        }} 
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
