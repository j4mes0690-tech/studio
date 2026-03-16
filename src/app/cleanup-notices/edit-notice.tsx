'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
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
import { Pencil, Camera, X, Trash2, Plus, Loader2, Check, Circle, CheckCircle2 } from 'lucide-react';
import type { Project, Photo, Area, CleanUpListItem, SubContractor, CleanUpNotice } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { dataUriToBlob, uploadFile } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';

const EditNoticeSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
});

type EditNoticeFormValues = z.infer<typeof EditNoticeSchema>;

export function EditCleanUpNotice({ notice, projects, subContractors, open: externalOpen, onOpenChange: setExternalOpen }: { 
  notice: CleanUpNotice, 
  projects: Project[], 
  subContractors: SubContractor[], 
  open?: boolean, 
  onOpenChange?: (open: boolean) => void 
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(notice.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<CleanUpListItem[]>(notice.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  // Item Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemSubId, setEditItemSubId] = useState<string | undefined>(undefined);

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);

  const form = useForm<EditNoticeFormValues>({
    resolver: zodResolver(EditNoticeSchema),
    defaultValues: { projectId: notice.projectId, areaId: notice.areaId || '', title: notice.title || '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    if (selectedProjectId) setAreas(selectedProject?.areas || []);
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (open && notice) {
      form.reset({ projectId: notice.projectId, areaId: notice.areaId || '', title: notice.title || '' });
      setPhotos(notice.photos || []);
      setItems(notice.items || []);
    }
  }, [open, notice, form]);

  const handleMetadataChange = () => {
    const values = form.getValues();
    startTransition(async () => {
        await updateDoc(doc(db, 'cleanup-notices', notice.id), {
            ...values,
            areaId: values.areaId || null,
        });
    });
  }

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    startTransition(async () => {
        const newItem: CleanUpListItem = {
            id: `item-${Date.now()}`,
            description: newItemText.trim(),
            status: 'open',
            photos: [],
            subContractorId: pendingSubId || null,
        };
        const newItemsList = [...items, newItem];
        setItems(newItemsList);
        await updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItemsList });
        setNewItemText('');
        setPendingSubId(undefined);
    });
  };

  const handleToggleStatus = (id: string) => {
    const newItemsList = items.map(i => i.id === id ? { ...i, status: (i.status === 'open' ? 'closed' : 'open') as 'open' | 'closed' } : i);
    setItems(newItemsList);
    updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItemsList });
  };

  const handleRemoveItem = (id: string) => {
    const newItemsList = items.filter(i => i.id !== id);
    setItems(newItemsList);
    updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItemsList });
  };

  const handleStartEdit = (item: CleanUpListItem) => {
    setEditingItemId(item.id);
    setEditItemText(item.description);
    setEditItemSubId(item.subContractorId || undefined);
  };

  const handleSaveEdit = (id: string) => {
    const newItemsList = items.map(i => i.id === id ? { ...i, description: editItemText, subContractorId: editItemSubId || null } : i);
    setItems(newItemsList);
    setEditingItemId(null);
    updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItemsList });
  };

  const onCaptureGeneral = (photo: Photo) => {
    startTransition(async () => {
        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `cleanup-notices/general/${notice.id}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        await updateDoc(doc(db, 'cleanup-notices', notice.id), {
            photos: arrayUnion(updatedPhoto)
        });
        setPhotos(prev => [...prev, updatedPhoto]);
    });
  };

  const onCaptureItem = (photo: Photo) => {
    if (itemPhotoTargetId) {
        startTransition(async () => {
            const blob = await dataUriToBlob(photo.url);
            const url = await uploadFile(storage, `cleanup-notices/items/${itemPhotoTargetId}-${Date.now()}.jpg`, blob);
            const updatedPhoto = { ...photo, url };
            const newItems = items.map(itm => itm.id === itemPhotoTargetId ? { ...itm, photos: [...(itm.photos || []), updatedPhoto] } : itm);
            setItems(newItems);
            await updateDoc(doc(db, 'cleanup-notices', notice.id), { items: newItems });
        });
        setItemPhotoTargetId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent 
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="space-y-1">
                <DialogTitle>Edit Clean Up Notice</DialogTitle>
                <DialogDescription>Record and assign cleaning requirements.</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
                {isPending && <Badge variant="secondary" className="animate-pulse">Saving...</Badge>}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
              <Form {...form}>
                  <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem><FormLabel>Project</FormLabel><Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Area / Plot</FormLabel>
                                  <Select onValueChange={(v) => { field.onChange(v); handleMetadataChange(); }} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                      {availableAreas.length > 0 && <Separator className="my-1" />}
                                      <SelectItem value="other">Other / Not Listed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} onBlur={handleMetadataChange} /></FormControl></FormItem>
                        )} />
                    </div>
                    
                    <div className="space-y-4">
                      <FormLabel className="font-black text-xs uppercase text-muted-foreground">Cleaning Requirements</FormLabel>
                      
                      <div className="flex gap-2 items-end bg-muted/20 p-4 rounded-xl border border-dashed">
                          <div className="flex-1">
                              <Input placeholder="What needs cleaning?..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}} />
                          </div>
                          <Select value={pendingSubId || 'unassigned'} onValueChange={v => setPendingSubId(v === 'unassigned' ? undefined : v)}>
                              <SelectTrigger className="w-40"><SelectValue placeholder="Assign" /></SelectTrigger>
                              <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button type="button" onClick={handleAddItem} disabled={!newItemText.trim()}><Plus className="h-4 w-4" /></Button>
                      </div>

                      <div className="space-y-3">
                          {items.map((listItem) => (
                              <div key={listItem.id} className="flex flex-col gap-3 p-4 border rounded-xl bg-background shadow-sm">
                                  {editingItemId === listItem.id ? (
                                      <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-1">
                                          <Input 
                                              value={editItemText} 
                                              onChange={e => setEditItemText(e.target.value)} 
                                              className="h-9 text-sm"
                                              autoFocus
                                          />
                                          <div className="flex items-center justify-between">
                                              <Select value={editItemSubId || 'unassigned'} onValueChange={v => setEditItemSubId(v === 'unassigned' ? undefined : v)}>
                                                  <SelectTrigger className="h-8 text-[10px] w-40"><SelectValue placeholder="Assign" /></SelectTrigger>
                                                  <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                              </Select>
                                              <div className="flex gap-1">
                                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingItemId(null)}><X className="h-4 w-4" /></Button>
                                                  <Button size="icon" variant="default" className="h-8 w-8" onClick={() => handleSaveEdit(listItem.id)}><Check className="h-4 w-4" /></Button>
                                              </div>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="flex items-start gap-3">
                                          <button 
                                              type="button"
                                              onClick={() => handleToggleStatus(listItem.id)}
                                              className="mt-1 flex-shrink-0 hover:scale-110 transition-transform"
                                          >
                                              {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                          </button>
                                          <div className="flex flex-col gap-3 flex-1 min-w-0">
                                              <div className="flex items-center justify-between">
                                                  <div className="flex flex-col min-w-0">
                                                      <span className={cn("text-sm font-bold truncate", listItem.status === 'closed' && "line-through opacity-50")}>{listItem.description}</span>
                                                      {listItem.subContractorId && <span className="text-[10px] text-muted-foreground uppercase font-black">{projectSubs.find(s => s.id === listItem.subContractorId)?.name}</span>}
                                                  </div>
                                                  <div className="flex gap-1 shrink-0">
                                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(listItem)}><Pencil className="h-4 w-4" /></Button>
                                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItemPhotoTargetId(listItem.id)}><Camera className="h-4 w-4" /></Button>
                                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(listItem.id)}><Trash2 className="h-4 w-4" /></Button>
                                                  </div>
                                              </div>

                                              {listItem.photos && listItem.photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap pt-2 border-t border-dashed">
                                                    {listItem.photos.map((p, pi) => (
                                                        <div key={pi} className="relative w-12 h-9 rounded border overflow-hidden">
                                                            <Image src={p.url} alt="Site" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                              )}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                      <FormLabel className="font-black text-xs uppercase text-muted-foreground">General Site Photos</FormLabel>
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
          
          <DialogFooter className="p-6 border-t bg-white shrink-0">
            <Button type="button" className="w-full h-12 font-bold" onClick={() => setOpen(false)}>Done & Finish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCaptureGeneral}
        title="Notice Documentation"
      />

      <CameraOverlay 
        isOpen={itemPhotoTargetId !== null} 
        onClose={() => setItemPhotoTargetId(null)} 
        onCapture={onCaptureItem}
        title="Requirement Evidence"
      />
    </>
  );
}
