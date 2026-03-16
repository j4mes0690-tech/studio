'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Camera, Upload, X, Trash2, Plus, UserPlus, User, RefreshCw, Loader2, Save, Pencil, Check } from 'lucide-react';
import type { Project, Photo, Area, CleanUpListItem, SubContractor, DistributionUser, CleanUpNotice } from '@/lib/types';
import { useFirestore, useStorage, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn, getProjectInitials, getNextReference, scrollToFirstError } from '@/lib/utils';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';

const NewNoticeSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
});

type NewNoticeFormValues = z.infer<typeof NewNoticeSchema>;

export function NewNotice({ projects, subContractors, allNotices }: { projects: Project[], subContractors: SubContractor[], allNotices: CleanUpNotice[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  
  const [isPending, startTransition] = useTransition();
  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<CleanUpListItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  // Item Editing State
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemSubId, setEditItemSubId] = useState<string | undefined>(undefined);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false); 
  const [itemPhotoTargetIdx, setItemPhotoTargetIdx] = useState<number | null>(null);

  const form = useForm<NewNoticeFormValues>({
    resolver: zodResolver(NewNoticeSchema),
    defaultValues: { projectId: '', areaId: '', title: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const selectedAreaId = form.watch('areaId');

  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    if (selectedProjectId) {
      setAreas(selectedProject?.areas || []);
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (selectedAreaId && selectedAreaId !== 'none' && selectedAreaId !== '') {
      if (selectedAreaId !== 'other') {
        const area = availableAreas.find(a => a.id === selectedAreaId);
        if (area) {
          form.setValue('title', `Clean Up Requirement: ${area.name}`);
        }
      }
    }
  }, [selectedAreaId, availableAreas, form]);

  const handleMetadataBlur = () => {
    if (activeNoticeId) {
        const values = form.getValues();
        updateDoc(doc(db, 'cleanup-notices', activeNoticeId), {
            title: values.title,
            projectId: values.projectId,
            areaId: values.areaId || null,
        });
    }
  }

  const ensureNoticeCreated = async (): Promise<string | null> => {
    if (activeNoticeId) return activeNoticeId;
    
    const values = form.getValues();
    if (!values.projectId || !values.title) {
        toast({ title: 'Missing Info', description: 'Project and Title are required before adding items.', variant: 'destructive' });
        return null;
    }

    const initials = getProjectInitials(selectedProject?.name || 'PRJ');
    const existingRefs = allNotices.map(l => ({ reference: l.reference, projectId: l.projectId }));
    const reference = getNextReference(existingRefs, values.projectId, 'CN', initials);

    const noticeData = {
      reference,
      projectId: values.projectId,
      areaId: values.areaId || null,
      title: values.title,
      createdAt: new Date().toISOString(),
      photos: [], 
      items: [],
      status: 'draft'
    };

    const docRef = await addDoc(collection(db, 'cleanup-notices'), noticeData);
    setActiveNoticeId(docRef.id);
    return docRef.id;
  };

  const handleAddItem = () => {
    if (!newItemText.trim() && pendingItemPhotos.length === 0) return;

    startTransition(async () => {
      const noticeId = await ensureNoticeCreated();
      if (!noticeId) return;

      try {
        const uploadedItemPhotos = await Promise.all(pendingItemPhotos.map(async (p, i) => {
          if (p.url.startsWith('data:')) {
            const blob = await dataUriToBlob(p.url);
            const url = await uploadFile(storage, `cleanup-notices/items/${noticeId}-${Date.now()}-${i}.jpg`, blob);
            return { ...p, url };
          }
          return p;
        }));

        const newItem: CleanUpListItem = {
          id: `item-${Date.now()}`,
          description: newItemText.trim() || 'Cleaning requirement',
          status: 'open',
          photos: uploadedItemPhotos,
          subContractorId: pendingSubId || null,
        };

        const noticeRef = doc(db, 'cleanup-notices', noticeId);
        await updateDoc(noticeRef, {
          items: arrayUnion(newItem)
        });

        setItems(prev => [...prev, newItem]);
        setNewItemText('');
        setPendingItemPhotos([]);
        setPendingSubId(undefined);
        
        toast({ title: 'Item Added', description: 'Auto-saved to list.' });
      } catch (err) {
        toast({ title: 'Save Error', description: 'Failed to add cleaning item.', variant: 'destructive' });
      }
    });
  };

  const handleStartEdit = (idx: number) => {
    const item = items[idx];
    setEditingItemIdx(idx);
    setEditItemText(item.description);
    setEditItemSubId(item.subContractorId || undefined);
  };

  const handleSaveEdit = (idx: number) => {
    const updatedItems = items.map((it, i) => 
      i === idx ? { ...it, description: editItemText, subContractorId: editItemSubId || null } : it
    );
    setItems(updatedItems);
    setEditingItemIdx(null);
    if (activeNoticeId) {
      updateDoc(doc(db, 'cleanup-notices', activeNoticeId), { items: updatedItems });
    }
  };

  const onCaptureGeneral = (photo: Photo) => {
    startTransition(async () => {
        if (activeNoticeId) {
            const blob = await dataUriToBlob(photo.url);
            const url = await uploadFile(storage, `cleanup-notices/general/${activeNoticeId}-${Date.now()}.jpg`, blob);
            const updatedPhoto = { ...photo, url };
            await updateDoc(doc(db, 'cleanup-notices', activeNoticeId), {
                photos: arrayUnion(updatedPhoto)
            });
            setPhotos(prev => [...prev, updatedPhoto]);
        } else {
            setPhotos(prev => [...prev, photo]);
        }
    });
  };

  const onCaptureItem = (photo: Photo) => {
    if (itemPhotoTargetIdx !== null) {
        const itemToUpdate = items[itemPhotoTargetIdx];
        startTransition(async () => {
            if (activeNoticeId) {
                const blob = await dataUriToBlob(photo.url);
                const url = await uploadFile(storage, `cleanup-notices/items/${itemToUpdate.id}-${Date.now()}.jpg`, blob);
                const updatedPhoto = { ...photo, url };
                const newItems = items.map((itm, i) => i === itemPhotoTargetIdx ? { ...itm, photos: [...(itm.photos || []), updatedPhoto] } : itm);
                await updateDoc(doc(db, 'cleanup-notices', activeNoticeId), { items: newItems });
                setItems(newItems);
            } else {
                setItems(prev => prev.map((itm, i) => i === itemPhotoTargetIdx ? { ...itm, photos: [...(itm.photos || []), photo] } : itm));
            }
        });
        setItemPhotoTargetIdx(null);
    } else {
        setPendingItemPhotos(prev => [...prev, photo]);
    }
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setItems([]);
      setActiveNoticeId(null);
      setEditingItemIdx(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="font-bold"><PlusCircle className="mr-2 h-4 w-4" />Record Cleaning Issue</Button></DialogTrigger>
        <DialogContent 
          className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
              <div className="flex items-center justify-between">
                  <DialogTitle>New Clean Up Notice</DialogTitle>
                  {activeNoticeId && <Badge variant="secondary" className="font-mono animate-in fade-in">Auto-saving Active</Badge>}
              </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
              <Form {...form}>
                  <form className="space-y-8">
                      <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="projectId" render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Project</FormLabel>
                                      <Select onValueChange={(val) => { field.onChange(val); handleMetadataBlur(); }} value={field.value}>
                                          <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                                          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                      </Select>
                                      <FormMessage />
                                  </FormItem>
                              )} />
                              <FormField control={form.control} name="areaId" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Area / Plot</FormLabel>
                                    <Select onValueChange={(val) => { field.onChange(val); handleMetadataBlur(); }} value={field.value} disabled={!selectedProjectId}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {availableAreas.map(a => (
                                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                        ))}
                                        {availableAreas.length > 0 && <Separator className="my-1" />}
                                        <SelectItem value="other">Other / Not Listed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                              )} />
                          </div>
                          <FormField control={form.control} name="title" render={({ field }) => (
                              <FormItem>
                                  <FormLabel>List Title</FormLabel>
                                  <FormControl><Input {...field} onBlur={handleMetadataBlur} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>

                      <div className="space-y-4">
                          <div className="flex justify-between items-center"><FormLabel className="font-black text-xs uppercase text-muted-foreground">Add Specific Requirements</FormLabel><VoiceInput onResult={setNewItemText} /></div>
                          <div className="flex gap-2 items-end bg-background p-4 rounded-xl border shadow-sm">
                              <div className="flex-1"><Input placeholder="Describe cleaning required..." value={newItemText} onChange={e => setNewItemText(e.target.value)} className="h-11 border-none shadow-none focus-visible:ring-0 px-0" /></div>
                              <div className="flex gap-1">
                                  <Select value={pendingSubId || 'unassigned'} onValueChange={v => setPendingSubId(v === 'unassigned' ? undefined : v)}>
                                      <SelectTrigger className={cn("px-2 border-none h-11 transition-all", pendingSubId ? "w-auto" : "w-10 justify-center")}>
                                          {pendingSubId ? <Badge variant="secondary" className="h-6 text-[9px] uppercase tracking-tighter">{projectSubs.find(s => s.id === pendingSubId)?.name}</Badge> : <UserPlus className="h-4 w-4 text-primary" />}
                                      </SelectTrigger>
                                      <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Button type="button" variant="ghost" className="h-11" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                                  <Button type="button" size="icon" className="h-11 rounded-lg" onClick={handleAddItem} disabled={isPending}>
                                      {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                  </Button>
                              </div>
                          </div>

                          {pendingItemPhotos.length > 0 && (
                            <div className="flex gap-2 p-3 bg-muted/20 rounded-xl border border-dashed">
                              {pendingItemPhotos.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-12"><Image src={p.url} alt="Pre" fill className="rounded-md object-cover border" /><button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-2 w-2" /></button></div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-3">
                              {items.map((item, idx) => (
                                  <div key={item.id} className="bg-white p-4 rounded-xl border shadow-sm group animate-in fade-in">
                                      {editingItemIdx === idx ? (
                                          <div className="flex flex-col gap-2 w-full">
                                              <Input 
                                                  value={editItemText} 
                                                  onChange={e => setEditItemText(e.target.value)} 
                                                  className="h-8 text-sm"
                                                  autoFocus
                                              />
                                              <div className="flex items-center justify-between">
                                                  <Select value={editItemSubId || 'unassigned'} onValueChange={v => setEditItemSubId(v === 'unassigned' ? undefined : v)}>
                                                      <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue placeholder="Assign" /></SelectTrigger>
                                                      <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                  </Select>
                                                  <div className="flex gap-1">
                                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingItemIdx(null)}><X className="h-3 w-3" /></Button>
                                                      <Button size="icon" variant="default" className="h-7 w-7" onClick={() => handleSaveEdit(idx)}><Check className="h-3 w-3" /></Button>
                                                  </div>
                                              </div>
                                          </div>
                                      ) : (
                                          <div className="flex flex-col gap-3">
                                              <div className="flex items-center justify-between">
                                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                      <span className="text-sm font-bold truncate">{item.description}</span>
                                                      <div className="mt-1 flex items-center gap-2">
                                                          {item.subContractorId && <Badge variant="secondary" className="text-[10px]">{projectSubs.find(s => s.id === item.subContractorId)?.name}</Badge>}
                                                          {item.photos && item.photos.length > 0 && <Badge variant="outline" className="text-[9px] h-4"><Camera className="h-2.5 w-2.5 mr-1" /> {item.photos.length} Photos</Badge>}
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-1 shrink-0">
                                                      <Button type="button" variant="ghost" size="icon" onClick={() => handleStartEdit(idx)}><Pencil className="h-4 w-4" /></Button>
                                                      <Button type="button" variant="ghost" size="icon" onClick={() => setItemPhotoTargetIdx(idx)}><Camera className="h-4 w-4" /></Button>
                                                  </div>
                                              </div>

                                              {item.photos && item.photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap pt-2 border-t border-dashed">
                                                    {item.photos.map((p, pi) => (
                                                        <div key={pi} className="relative w-12 h-9 rounded border overflow-hidden">
                                                            <Image src={p.url} alt="Site" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                          <FormLabel className="font-black text-xs uppercase text-muted-foreground">General Documentation</FormLabel>
                          <div className="flex flex-wrap gap-3">
                              {photos.map((p, i) => (
                                  <div key={i} className="relative w-24 h-24 group"><Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2" /></div>
                              ))}
                              <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase tracking-tighter">Photo</span></Button>
                          </div>
                      </div>
                  </form>
              </Form>
          </div>

          <DialogFooter className="p-6 bg-white border-t shrink-0">
              <Button type="button" className="w-full h-12 font-bold" onClick={() => setOpen(false)}>
                  Done & Close
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCaptureGeneral}
        title="General Site Documentation"
      />

      <CameraOverlay 
        isOpen={isItemCameraOpen || itemPhotoTargetIdx !== null} 
        onClose={() => { setIsItemCameraOpen(false); setItemPhotoTargetIdx(null); }} 
        onCapture={onCaptureItem}
        title="Requirement Photo"
      />
    </>
  );
}
