'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import type { QualityChecklist, Project, ChecklistItem, ChecklistItemStatus, SubContractor, Photo, QCSection } from '@/lib/types';
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
import { Users, Trash2, Loader2, Camera, Upload, X, RefreshCw, Maximize2, FileCheck } from 'lucide-react';
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
  
  // Local state for items/sections
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items || []);
  const [sections, setSections] = useState<QCSection[]>(checklist.sections || []);
  const [generalPhotos, setGeneralPhotos] = useState<Photo[]>(checklist.photos || []);
  
  // Camera & Media State
  const [activeItemContext, setActiveItemForPhoto] = useState<{ sectionId?: string, itemId: string } | null>(null);
  const [isCapturingGeneral, setIsCapturingGeneral] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(checklist.items || []);
    setSections(checklist.sections || []);
    setGeneralPhotos(checklist.photos || []);
  }, [checklist]);

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
          });
    });
  }

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'quality-checklists', checklist.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Checklist removed.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleStatusChange = (itemId: string, status: ChecklistItemStatus, sectionId?: string) => {
    if (sectionId) {
        const newSections = sections.map(sec => {
            if (sec.id === sectionId) {
                return { ...sec, items: sec.items.map(i => i.id === itemId ? { ...i, status } : i) };
            }
            return sec;
        });
        setSections(newSections);
        updateChecklistOnServer({ sections: newSections });
    } else {
        const newItems = items.map((item) =>
            item.id === itemId ? { ...item, status } : item
        );
        setItems(newItems);
        updateChecklistOnServer({ items: newItems });
    }
  };
  
  const handleCommentChange = (itemId: string, comment: string, sectionId?: string) => {
    if (sectionId) {
        setSections(prev => prev.map(sec => {
            if (sec.id === sectionId) {
                return { ...sec, items: sec.items.map(i => i.id === itemId ? { ...i, comment } : i) };
            }
            return sec;
        }));
    } else {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, comment } : i));
    }
  }

  const handleCommentBlur = (itemId: string, sectionId?: string) => {
    if (sectionId) {
        updateChecklistOnServer({ sections });
    } else {
        updateChecklistOnServer({ items });
    }
  }

  const onCapture = (photo: Photo) => {
    if (isCapturingGeneral) {
        handleGeneralPhotoUpdate(photo);
    } else if (activeItemContext) {
        handlePhotoUpdate(activeItemContext.itemId, photo, activeItemContext.sectionId);
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

  const handlePhotoUpdate = (itemId: string, photo: Photo, sectionId?: string) => {
    startTransition(async () => {
      try {
        let url = photo.url;
        if (photo.url.startsWith('data:')) {
          const blob = await dataUriToBlob(photo.url);
          url = await uploadFile(storage, `quality-control/${checklist.id}/${itemId}-${Date.now()}.jpg`, blob);
        }

        if (sectionId) {
            const newSections = sections.map(sec => {
                if (sec.id === sectionId) {
                    return { ...sec, items: sec.items.map(i => i.id === itemId ? { ...i, photos: [...(i.photos || []), { ...photo, url }] } : i) };
                }
                return sec;
            });
            setSections(newSections);
            updateChecklistOnServer({ sections: newSections });
        } else {
            const newItems = items.map(item => {
                if (item.id === itemId) {
                    return { ...item, photos: [...(item.photos || []), { ...photo, url }] };
                }
                return item;
            });
            setItems(newItems);
            updateChecklistOnServer({ items: newItems });
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to save photo.', variant: 'destructive' });
      }
    });
  };

  const removePhoto = (itemId: string, photoIdx: number, sectionId?: string) => {
    if (sectionId) {
        const newSections = sections.map(sec => {
            if (sec.id === sectionId) {
                return { ...sec, items: sec.items.map(i => i.id === itemId ? { ...i, photos: (i.photos || []).filter((_, pi) => pi !== photoIdx) } : i) };
            }
            return sec;
        });
        setSections(newSections);
        updateChecklistOnServer({ sections: newSections });
    } else {
        const newItems = items.map(item => {
            if (item.id === itemId) {
                return { ...item, photos: (item.photos || []).filter((_, i) => i !== photoIdx) };
            }
            return item;
        });
        setItems(newItems);
        updateChecklistOnServer({ items: newItems });
    }
  };

  const project = projects.find((p) => p.id === checklist.projectId);
  const area = project?.areas?.find(a => a.id === checklist.areaId);

  const flatItems = sections.length > 0 ? sections.flatMap(s => s.items) : items;
  const completedCount = flatItems.filter((i) => i.status !== 'pending').length;
  const totalCount = flatItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const hasFailure = flatItems.some((i) => i.status === 'no');

  const renderItem = (item: ChecklistItem, sectionId?: string) => (
    <div key={item.id} className={cn("space-y-3 p-4 rounded-xl border transition-all", item.status === 'no' ? 'border-destructive bg-destructive/5' : 'bg-background hover:border-primary/30 shadow-sm')}>
      <Label className="font-bold text-foreground text-sm leading-relaxed block">{item.text}</Label>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <RadioGroup value={item.status} onValueChange={(status) => handleStatusChange(item.id, status as ChecklistItemStatus, sectionId)} className="flex items-center space-x-6">
            <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id={`${item.id}-yes`} /><Label htmlFor={`${item.id}-yes`} className="text-xs font-bold uppercase text-green-700 cursor-pointer">Pass</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="no" id={`${item.id}-no`} /><Label htmlFor={`${item.id}-no`} className="text-xs font-bold uppercase text-red-700 cursor-pointer">Fail</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="na" id={`${item.id}-na`} /><Label htmlFor={`${item.id}-na`} className="text-xs font-bold uppercase text-muted-foreground cursor-pointer">N/A</Label></div>
        </RadioGroup>
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2 font-bold" onClick={() => { setActiveItemForPhoto({ itemId: item.id, sectionId }); setIsCapturingGeneral(false); }}><Camera className="h-4 w-4" /> Camera</Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2 font-bold" onClick={() => { setActiveItemForPhoto({ itemId: item.id, sectionId }); setIsCapturingGeneral(false); fileInputRef.current?.click(); }}><Upload className="h-4 w-4" /> Upload</Button>
        </div>
      </div>
      <Input placeholder="Verification comments..." value={item.comment || ''} onChange={(e) => handleCommentChange(item.id, e.target.value, sectionId)} onBlur={() => handleCommentBlur(item.id, sectionId)} className="text-xs bg-muted/5 border-dashed" />
      {item.photos && item.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed">
          {item.photos.map((p, idx) => (
            <div key={idx} className="relative w-20 h-16 rounded border overflow-hidden group shadow-sm bg-muted">
                <Image src={p.url} alt="Verification" fill className="object-cover cursor-pointer" onClick={() => setViewingPhoto(p)}/>
                <button type="button" className="absolute top-0 right-0 bg-destructive text-white p-1 shadow-md" onClick={() => removePhoto(item.id, idx, sectionId)}><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  return (
    <>
      <Card className={cn("transition-all", hasFailure && 'border-destructive border-2 shadow-destructive/10')}>
        <CardHeader className="p-4 md:p-6 bg-muted/5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-xl">{checklist.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="font-bold text-foreground text-xs">{project?.name}</span>
                <span className="text-muted-foreground">&gt;</span>
                <span className="font-bold text-primary text-xs">{area?.name || 'General Site'}</span>
                <span className="text-xs text-muted-foreground/80">•</span>
                <span className="text-xs text-muted-foreground/80">Created <ClientDate date={checklist.createdAt} /></span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={hasFailure ? 'destructive' : 'secondary'} className="h-6 font-black uppercase">{checklist.trade}</Badge>
              <DistributeChecklistButton checklist={checklist} project={project} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Assigned Checklist?</AlertDialogTitle><AlertDialogDescription>This will remove verification records for this area.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-8">
          <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-dashed">
              <div className='flex justify-between items-end mb-1'>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Compliance Progress</p>
                  <span className={cn("text-xs font-black", hasFailure ? "text-destructive" : "text-primary")}>{completedCount} / {totalCount} Points</span>
              </div>
            <Progress value={progress} className="h-2" indicatorClassName={hasFailure ? 'bg-destructive' : ''} />
          </div>

          <div className="space-y-8">
            {sections.length > 0 ? (
                sections.map((section) => (
                    <div key={section.id} className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <FileCheck className="h-4 w-4 text-primary" />
                            <h3 className="font-black text-xs uppercase tracking-widest text-primary">{section.title}</h3>
                        </div>
                        <div className="grid gap-4">
                            {section.items.map(item => renderItem(item, section.id))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="grid gap-4">
                    {items.map(item => renderItem(item))}
                </div>
            )}
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="general-photos" className="border-b-0">
              <AccordionTrigger className="text-sm font-bold uppercase tracking-widest hover:no-underline">General Documentation</AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2 font-bold" onClick={() => { setIsCapturingGeneral(true); setActiveItemForPhoto(null); }}><Camera className="h-4 w-4" /> Take Photo</Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2 font-bold" onClick={() => { setIsCapturingGeneral(true); setActiveItemForPhoto(null); generalFileInputRef.current?.click(); }}><Upload className="h-4 w-4" /> Upload</Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {generalPhotos.map((p, idx) => (
                    <div key={idx} className="relative aspect-video rounded-lg border-2 border-muted overflow-hidden group shadow-sm bg-muted">
                        <Image src={p.url} alt="Gen" fill className="object-cover cursor-pointer" onClick={() => setViewingPhoto(p)}/>
                        <button type="button" className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 shadow-md" onClick={() => removeGeneralPhoto(idx)}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <CameraOverlay 
        isOpen={isCapturingGeneral || activeItemContext !== null} 
        onClose={() => { setIsCapturingGeneral(false); setActiveItemForPhoto(null); }} 
        onCapture={onCapture}
        title="Quality Verification documentation"
      />

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
          const files = e.target.files;
          if (!files || !activeItemContext) return;
          Array.from(files).forEach(f => {
            const reader = new FileReader();
            reader.onload = (re) => handlePhotoUpdate(activeItemContext.itemId, { url: re.target?.result as string, takenAt: new Date().toISOString() }, activeItemContext.sectionId);
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
