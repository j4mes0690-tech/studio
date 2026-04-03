'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';

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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Pencil, 
  Camera, 
  X, 
  Trash2, 
  Plus, 
  UserPlus, 
  Loader2, 
  Save, 
  Send,
  Check,
  Circle,
  CheckCircle2,
  CloudUpload,
  AlertTriangle
} from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem, SubContractor, DistributionUser, SnaggingItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useStorage, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { getPartnerEmails, cn, scrollToFirstError } from '@/lib/utils';
import { generateSnaggingPDF } from '@/lib/pdf-utils';
import { CameraOverlay } from '@/components/camera-overlay';
import { sendSubcontractorReportAction } from './actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EditSnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type EditSnaggingListFormValues = z.infer<typeof EditSnaggingListSchema>;

export function EditSnaggingItem({ item, projects, subContractors }: { item: SnaggingItem, projects: Project[], subContractors: SubContractor[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<SnaggingListItem[]>(item.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string>('unassigned');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  
  // Item Editing State
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemSubId, setEditItemSubId] = useState<string>('unassigned');

  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false);
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<'draft' | 'save' | 'issue'>('save');
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  const form = useForm<EditSnaggingListFormValues>({
    resolver: zodResolver(EditSnaggingListSchema),
    defaultValues: { 
      projectId: item.projectId, 
      areaId: item.areaId || '', 
      title: item.title || '', 
      description: item.description || '',
      status: item.status || 'issued'
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id) && !!sub.isSubContractor);
  }, [selectedProjectId, selectedProject, subContractors]);

  useEffect(() => {
    if (selectedProjectId) setAreas(selectedProject?.areas || []);
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (open) {
      form.reset({ 
        projectId: item.projectId, 
        areaId: item.areaId || '', 
        title: item.title || '', 
        description: item.description || '',
        status: item.status || 'issued'
      });
      setPhotos(item.photos || []);
      setItems(item.items || []);
      setEditingItemIdx(null);
      setPendingItemPhotos([]);
    }
  }, [open, item, form]);

  const handleAddItem = () => {
    if (!newItemText.trim() && pendingItemPhotos.length === 0) return;
    const newItem: SnaggingListItem = {
        id: `item-${Date.now()}`,
        description: newItemText.trim() || 'No description',
        status: 'open',
        photos: [...pendingItemPhotos],
        subContractorId: pendingSubId === 'unassigned' ? null : pendingSubId,
        completionPhotos: []
    };
    setItems(prev => [...prev, newItem]);
    setNewItemText('');
    setPendingSubId('unassigned');
    setPendingItemPhotos([]);
  };

  const handleStartEditItem = (idx: number) => {
    const snagItem = items[idx];
    setEditingItemIdx(idx);
    setEditItemText(snagItem.description);
    setEditItemSubId(snagItem.subContractorId || 'unassigned');
  };

  const handleSaveEditItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, description: editItemText, subContractorId: editItemSubId === 'unassigned' ? null : editItemSubId } : it));
    setEditingItemIdx(null);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleToggleStatus = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: (it.status === 'open' ? 'closed' : 'open') as any } : i));
  };

  const onCaptureGeneral = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  };

  const onCaptureItem = (photo: Photo) => {
    if (itemPhotoTargetId) {
      setItems(prev => prev.map(itm => itm.id === itemPhotoTargetId ? { ...itm, photos: [...(itm.photos || []), photo] } : itm));
      setItemPhotoTargetId(null);
    } else {
        setPendingItemPhotos(prev => [...prev, photo]);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(item.items) || 
           photos.length !== (item.photos?.length || 0) ||
           form.getValues().title !== item.title ||
           form.getValues().areaId !== (item.areaId || '') ||
           form.getValues().projectId !== item.projectId;
  }, [items, photos, form, item]);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardAlert(true);
    } else {
      setOpen(false);
    }
  };

  const onSubmit = (values: EditSnaggingListFormValues) => {
    const isIssuing = submitMode === 'issue';
    const isDrafting = submitMode === 'draft';

    if (items.length === 0) {
        toast({ title: 'List Empty', description: 'Add at least one snagging item before issuing reports.', variant: 'destructive' });
        return;
    }

    if (isIssuing && !allUsers) {
        toast({ title: 'System Loading', description: 'User registry is still syncing. Please wait a moment and try again.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Updating records and visual documentation...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/general/${item.id}-${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedItems = await Promise.all(items.map(async (snag) => {
            const updatedPhotos = await Promise.all((snag.photos || []).map(async (p, pi) => {
                if (p.url.startsWith('data:')) {
                    const blob = await dataUriToBlob(p.url);
                    const url = await uploadFile(storage, `snagging/items/${snag.id}-${Date.now()}-${pi}.jpg`, blob);
                    return { ...p, url };
                }
                return p;
            }));
            return { ...snag, photos: updatedPhotos };
        }));

        const targetStatus = isIssuing ? 'issued' : (isDrafting ? 'draft' : values.status);

        const docRef = doc(db, 'snagging-items', item.id);
        const updates: any = {
          ...values,
          areaId: values.areaId || null,
          items: uploadedItems,
          photos: uploadedPhotos,
          status: targetStatus
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Snagging list updated successfully.' });

        if (isIssuing && allUsers) {
            toast({ title: 'Distributing', description: 'Sending reports to partners...' });
            const area = selectedProject?.areas?.find(a => a.id === values.areaId);
            const subIds = Array.from(new Set(uploadedItems.map(i => i.subContractorId).filter(id => !!id))) as string[];
            let sentCount = 0;

            for (const subId of subIds) {
                const sub = subContractors.find(s => s.id === subId);
                const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
                
                if (sub && recipientEmails.length > 0) {
                    const myItems = uploadedItems.filter(i => i.subContractorId === subId && i.status === 'open');
                    if (myItems.length === 0) continue;

                    const pdf = await generateSnaggingPDF({
                        title: 'Snagging Audit Report',
                        project: selectedProject,
                        subContractors,
                        aggregatedEntries: myItems.map(snag => ({
                            listTitle: values.title,
                            areaName: area?.name || 'General Site',
                            snag
                        })),
                        generalPhotos: uploadedPhotos,
                        scopeLabel: `Trade: ${sub.name} (Outstanding Items)`
                    });

                    const pdfBase64 = pdf.output('datauristring').split(',')[1];
                    const fileName = `SnagReport-${sub.name.replace(/\s+/g, '-')}-${values.title.replace(/\s+/g, '-')}.pdf`;

                    const result = await sendSubcontractorReportAction({
                        email: sub.email,
                        name: sub.name,
                        projectName: selectedProject?.name || 'Project',
                        areaName: area?.name || 'General Area',
                        pdfBase64,
                        fileName
                    });

                    if (result.success) {
                        sentCount++;
                    } else {
                        toast({ 
                            title: `Report Failed (${sub.name})`, 
                            description: result.message || 'Check your email configuration.', 
                            variant: 'destructive' 
                        });
                    }
                }
            }
            if (sentCount > 0) {
                toast({ title: 'Distribution Complete', description: `${sentCount} trade reports sent.` });
            }
        }

        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update record. Check connection.', variant: 'destructive' });
      }
    });
  };

  const unsyncedCount = items.reduce((acc, itm) => acc + (itm.photos || []).filter(p => p.url.startsWith('data:')).length, 0) + photos.filter(p => p.url.startsWith('data:')).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => { if(!val) handleRequestClose(); else setOpen(true); }}>
        <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent 
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/5 flex items-center justify-between">
            <div>
                <DialogTitle>Edit Snagging List</DialogTitle>
                <DialogDescription>Modify defects and area documentation. Changes sync when you click Save.</DialogDescription>
            </div>
            {unsyncedCount > 0 && (
                <Badge variant="secondary" className="gap-2 h-7 px-3 bg-primary/10 text-primary border-primary/20 animate-in fade-in">
                    <CloudUpload className="h-3.5 w-3.5" />
                    {unsyncedCount} Assets Staged
                </Badge>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
              <Form {...form}>
                  <form className="space-y-8">
                    <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="areaId" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Area / Level</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                                      {availableAreas.length > 0 && <Separator className="my-1" />}
                                      <SelectItem value="other">Other / Manual</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="title" render={({ field }) => (
                            <FormItem><FormLabel>List Identification</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                    </div>
                    
                    <Separator />

                    <div className="space-y-4">
                      <FormLabel className="text-xs font-black uppercase text-muted-foreground tracking-widest">Manage Defects</FormLabel>
                      
                      <div className="flex gap-2 items-end bg-muted/20 p-4 rounded-xl border border-dashed">
                          <div className="flex-1 space-y-2">
                              <div className="flex justify-between items-center">
                                  <Label className="text-[10px] font-bold">New Defect</Label>
                                  <VoiceInput onResult={setNewItemText} />
                              </div>
                              <Input placeholder="Describe the issue..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}} className="bg-background" />
                          </div>
                          <div className="flex gap-1">
                              <Select value={pendingSubId || 'unassigned'} onValueChange={setPendingSubId}>
                                  <SelectTrigger className="w-40 bg-background h-11 px-2 justify-center">
                                      <div className="flex items-center gap-2">
                                          {pendingSubId !== 'unassigned' ? (
                                              <Badge variant="secondary" className="hidden md:block h-6 text-[9px] font-black max-w-[100px] truncate uppercase">
                                                  {projectSubs.find(s => s.id === pendingSubId)?.name}
                                              </Badge>
                                          ) : <UserPlus className="h-4 w-4 text-primary" />}
                                      </div>
                                  </SelectTrigger>
                                  <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button type="button" variant="outline" className="h-10" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                              <Button type="button" onClick={handleAddItem} disabled={!newItemText.trim() && pendingItemPhotos.length === 0} size="icon" className="h-10 w-10"><Plus className="h-4 w-4" /></Button>
                          </div>
                      </div>

                      {pendingItemPhotos.length > 0 && (
                        <div className="flex gap-2 p-3 bg-muted/20 rounded-xl border border-dashed">
                          {pendingItemPhotos.map((p, idx) => (
                            <div key={idx} className="relative w-16 h-12">
                              <Image src={p.url} alt="Pre" fill className="rounded-md object-cover border" /><button type="button" className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, i) => i !== idx))}><X className="h-2 w-2" /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3">
                          {items.map((listItem, idx) => (
                              <div key={`${listItem.id}-${idx}`} className={cn(
                                "p-4 border rounded-xl bg-background shadow-sm transition-all group",
                                editingItemIdx === idx && "ring-2 ring-primary border-transparent"
                              )}>
                                  {editingItemIdx === idx ? (
                                      <div className="space-y-4 animate-in slide-in-from-top-1">
                                          <div className="space-y-2">
                                              <Label className="text-[10px] font-bold">Defect Description</Label>
                                              <Input value={editItemText} onChange={e => setEditItemText(e.target.value)} className="h-9" autoFocus />
                                          </div>
                                          <div className="flex justify-between items-center">
                                              <Select value={editItemSubId} onValueChange={setEditItemSubId}>
                                                  <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                                                  <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                              </Select>
                                              <div className="flex gap-1">
                                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setItemPhotoTargetId(listItem.id)}><Camera className="h-4 w-4" /></Button>
                                                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingItemIdx(null)}>Cancel</Button>
                                                  <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => handleSaveEditItem(idx)}><Check className="h-3.5 w-3.5" /> Done</Button>
                                              </div>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-3 flex-1 min-w-0">
                                              <button type="button" onClick={() => handleToggleStatus(idx)} className="mt-1 flex-shrink-0 transition-transform active:scale-90">
                                                  {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                              </button>
                                              <div className="min-w-0 flex-1">
                                                  <p className={cn("text-sm font-bold truncate block", listItem.status === 'closed' && "line-through opacity-50")}>{listItem.description}</p>
                                                  {listItem.subContractorId && <Badge variant="secondary" className="text-[10px] font-black h-4 px-1.5">{projectSubs.find(s => s.id === listItem.subContractorId)?.name}</Badge>}
                                                  {listItem.photos && listItem.photos.length > 0 && (
                                                      <div className="flex gap-1.5 mt-2 flex-wrap">
                                                          {listItem.photos.map((p, pi) => (
                                                              <div key={pi} className="relative w-8 h-6 rounded border bg-muted overflow-hidden">
                                                                  <Image src={p.url} alt="Defect" fill className="object-cover" />
                                                              </div>
                                                          ))}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                          <div className="flex gap-1">
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleStartEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setItemPhotoTargetId(listItem.id); setIsItemCameraOpen(true); }}><Camera className="h-4 w-4" /></Button>
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                          <FormLabel className="font-black text-xs uppercase text-muted-foreground tracking-widest">Area Photos</FormLabel>
                          <div className="flex flex-wrap gap-3">
                              {photos.map((p, i) => (
                                  <div key={i} className="relative w-24 h-24 group">
                                      <Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2" />
                                      <button 
                                          type="button" 
                                          className="absolute -top-2 -right-2 bg-destructive text-white h-6 w-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95" 
                                          onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                                      >
                                          <X className="h-3.5 w-3.5" />
                                      </button>
                                  </div>
                              ))}
                              <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase">Photo</span></Button>
                          </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t pb-2">
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full h-12 gap-2" 
                            disabled={isPending} 
                            onClick={() => { setSubmitMode('draft'); form.handleSubmit((v) => onSubmit(v))(); }}
                        >
                            <Save className="h-4 w-4" /> Save Draft
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full sm:flex-1 h-12 font-bold gap-2" 
                            disabled={isPending} 
                            onClick={() => { setSubmitMode('save'); form.handleSubmit((v) => onSubmit(v))(); }}
                        >
                            <CloudUpload className="h-4 w-4" /> Save & Sync
                        </Button>
                        <Button 
                            type="button" 
                            className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                            disabled={isPending} 
                            onClick={() => { setSubmitMode('issue'); form.handleSubmit((v) => onSubmit(v))(); }}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Sync & Send
                        </Button>
                    </div>
                  </form>
              </Form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              You have modified this snagging list. Closing will lose any staged defects or photos that haven't been synced to the project mainframe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardAlert(false)}>Stay in Editor</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowDiscardAlert(false);
                setOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Discard & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCaptureGeneral}
        title="Snag List Evidence"
      />

      <CameraOverlay 
        isOpen={isItemCameraOpen || itemPhotoTargetId !== null} 
        onClose={() => { setIsItemCameraOpen(false); setItemPhotoTargetId(null); }} 
        onCapture={onCaptureItem}
        title="Specific Defect Documentation"
      />
    </>
  );
}
