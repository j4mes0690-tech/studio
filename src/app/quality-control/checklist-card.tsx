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
import { CameraOverlay } from '@/components/camera-overlay';

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
  const [items, setItems] = useState<ChecklistItem>(checklist.items);
  const [generalPhotos, setGeneralPhotos] = useState<Photo[]>(checklist.photos || []);
  
  // Camera & Media State
  const [activeItemForPhoto, setActiveItemForPhoto] = useState<string | null>(null);
  const [isCapturingGeneral, setIsCapturingGeneral] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(checklist.items);
    setGeneralPhotos(checklist.photos || []);
  }, [checklist.items, checklist.photos]);

  const updateChecklistOnServer = (updates: Partial<QualityChecklist>) => {
    startTransition(async () => {
        const docRef = doc(db, 'quality-checklists', checklist.id);
        
        updateDoc(docRef, updates)
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
            if (updates.items) setItems(checklist.items);
            if (updates.photos) setGeneralPhotos(checklist.photos || []);
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
    updateChecklistOnServer({ items: newItems });
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
      updateChecklistOnServer({ items: items });
    }
  }

  const onCapture = (photo: Photo) => {
    if (isCapturingGeneral) {
        handleGeneralPhotoUpdate(photo);
    } else if (activeItemForPhoto) {
        handlePhotoUpdate(activeItemForPhoto, photo);
    }
    setIsCapturingGeneral(false);
    setActiveItemForPhoto(null);
  };

  const handleGeneralPhotoUpdate = (photo: Photo) => {
    startTransition(async () => {
      try {
        let url = photo.url;
        if (photo.url.startsWith('data:')) {
          const blob = await dataUriToBlob(photo.url);
          url = await uploadFile(storage, `quality-control/${checklist.id}/general-${Date.now()}.jpg`, blob);
        }

        const newPhotos = [...generalPhotos, { ...photo, url }];
        setGeneralPhotos(newPhotos);
        updateChecklistOnServer({ photos: newPhotos });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to save photo.', variant: 'destructive' });
      }
    });
  }

  const removeGeneralPhoto = (photoIdx: number) => {
    const newPhotos = generalPhotos.filter((_, i) => i !== photoIdx);
    setGeneralPhotos(newPhotos);
    updateChecklistOnServer({ photos: newPhotos });
  }

  const handlePhotoUpdate = (itemId: string, photo: Photo) => {
    startTransition(async () => {
      try {
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
        updateChecklistOnServer({ items: newItems });
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
    updateChecklistOnServer({ items: newItems });
  };

  const project = projects.find((p) => p.id === checklist.projectId);
  const area = project?.areas?.find(a => a.id === checklist.areaId);

  const completedItems = items.filter((item) => item.status !== 'pending').length;
  const progress = items.length > 0 ? (completedItems / items.length) * 100 : 0;
  const hasFailure = items.some((item) => item.status === 'no');
  
  return (
    <>
      <Card className={cn(hasFailure && 'border-destructive')}>
        <CardHeader className="p-4 md:p-6">
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
                  <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Assigned Checklist?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the "{checklist.title}" checklist and all its recorded evidence for this area.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="space-y-2">
              <div className='flex justify-between items-center text-sm'>
                  <p className="text-muted-foreground">Verification Progress</p>
                  <p className="font-medium">{completedItems} / {items.length} Points</p>
              </div>
            <Progress value={progress} indicatorClassName={hasFailure ? 'bg-destructive' : ''} />
          </div>

          <Accordion type="single" collapsible className="w-full" defaultValue={defaultExpanded ? "items" : undefined}>
            <AccordionItem value="items">
              <AccordionTrigger className="text-sm font-semibold">Compliance Points</AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className={cn("space-y-3 p-3 rounded-md border transition-colors", item.status === 'no' ? 'border-destructive bg-destructive/5' : 'border-transparent bg-muted/10 hover:border-border')}>
                      <Label className="font-bold text-foreground text-sm leading-relaxed">{item.text}</Label>
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <RadioGroup value={item.status} onValueChange={(status) => handleStatusChange(item.id, status as ChecklistItemStatus)} className="flex items-center space-x-6" disabled={isPending}>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id={`${item.id}-yes`} /><Label htmlFor={`${item.id}-yes`}>Pass</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="no" id={`${item.id}-no`} /><Label htmlFor={`${item.id}-no`}>Fail</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="na" id={`${item.id}-na`} /><Label htmlFor={`${item.id}-na`}>N/A</Label></div>
                        </RadioGroup>
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => { setActiveItemForPhoto(item.id); setIsCapturingGeneral(false); }}><Camera className="h-4 w-4" /></Button>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => { setActiveItemForPhoto(item.id); setIsCapturingGeneral(false); fileInputRef.current?.click(); }}><Upload className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <Input placeholder="Trade compliance notes..." value={item.comment || ''} onChange={(e) => handleCommentChange(item.id, e.target.value)} onBlur={() => handleCommentBlur(item.id)} disabled={isPending} className="text-sm bg-background" />
                      {item.photos && item.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {item.photos.map((p, idx) => (
                            <div key={idx} className="relative w-16 h-12 rounded border bg-background overflow-hidden group shadow-sm">
                                <Image src={p.url} alt="Ins" fill className="object-cover cursor-pointer" onClick={() => setViewingPhoto(p)}/>
                                <button 
                                    type="button" 
                                    className="absolute top-0 right-0 bg-destructive text-white p-0.5 shadow-md transition-opacity" 
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

            <AccordionItem value="general-photos">
              <AccordionTrigger className="text-sm font-semibold">General Site Photos</AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => { setIsCapturingGeneral(true); setActiveItemForPhoto(null); }}><Camera className="h-4 w-4" /> Take Photo</Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => { setIsCapturingGeneral(true); setActiveItemForPhoto(null); generalFileInputRef.current?.click(); }}><Upload className="h-4 w-4" /> Upload</Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {generalPhotos.map((p, idx) => (
                    <div key={idx} className="relative aspect-video rounded-md border overflow-hidden group bg-muted shadow-sm">
                        <Image src={p.url} alt="Gen" fill className="object-cover cursor-pointer" onClick={() => setViewingPhoto(p)}/>
                        <button 
                            type="button" 
                            className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 shadow-md transition-opacity" 
                            onClick={() => removeGeneralPhoto(idx)}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <CameraOverlay 
        isOpen={isCapturingGeneral || activeItemForPhoto !== null} 
        onClose={() => { setIsCapturingGeneral(false); setActiveItemForPhoto(null); }} 
        onCapture={onCapture}
        title="Quality Verification Photo"
      />

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
          const files = e.target.files;
          if (!files || !activeItemForPhoto) return;
          Array.from(files).forEach(f => {
            const reader = new FileReader();
            reader.onload = (re) => handlePhotoUpdate(activeItemForPhoto, { url: re.target?.result as string, takenAt: new Date().toISOString() });
            reader.readAsDataURL(f);
          });
          setActiveItemForPhoto(null);
      }} />

      <input type="file" ref={generalFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          Array.from(files).forEach(f => {
            const reader = new FileReader();
            reader.onload = (re) => handleGeneralPhotoUpdate({ url: re.target?.result as string, takenAt: new Date().toISOString() });
            reader.readAsDataURL(f);
          });
          setIsCapturingGeneral(false);
      }} />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
