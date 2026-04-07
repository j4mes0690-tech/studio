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
import { 
  PlusCircle, 
  Camera, 
  Upload, 
  X, 
  Trash2, 
  Plus, 
  UserPlus, 
  RefreshCw, 
  Loader2, 
  Save, 
  CheckCircle2, 
  Send, 
  Pencil, 
  Check, 
  Circle, 
  CloudUpload,
  AlertTriangle 
} from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem, SubContractor, DistributionUser, SnaggingItem } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useStorage, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { cn, getProjectInitials, getNextReference, getPartnerEmails, scrollToFirstError } from '@/lib/utils';
import { CameraOverlay } from '@/components/camera-overlay';
import { generateSnaggingPDF } from '@/lib/pdf-utils';
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

const SnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
  status: z.enum(['draft', 'issued']).default('issued'),
});

type NewSnaggingListFormValues = z.infer<typeof SnaggingListSchema>;

/**
 * sanitizeSnagItem - Ensures all fields are Firestore-compliant (no undefined).
 */
const sanitizeSnagItem = (itm: any): SnaggingListItem => ({
    id: itm.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    description: itm.description || 'No description',
    status: itm.status || 'open',
    photos: (itm.photos || []).map((p: any) => ({ url: p.url || '', takenAt: p.takenAt || new Date().toISOString() })),
    subContractorId: itm.subContractorId || null,
    subContractorComment: itm.subContractorComment || null,
    completionPhotos: (itm.completionPhotos || []).map((p: any) => ({ url: p.url || '', takenAt: p.takenAt || new Date().toISOString() })),
    provisionallyCompletedAt: itm.provisionallyCompletedAt || null,
    closedAt: itm.closedAt || null
});

export function NewSnaggingItem({ projects, subContractors, allSnaggingLists }: { projects: Project[], subContractors: SubContractor[], allSnaggingLists: SnaggingItem[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { email: sessionEmail } = useUser();
  
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<SnaggingListItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  
  // Item Editing State
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemSubId, setEditItemSubId] = useState<string | undefined>(undefined);

  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false); 
  const [itemPhotoTargetIdx, setItemPhotoTargetIdx] = useState<number | null>(null);
  const [submitMode, setSubmitMode] = useState<'draft' | 'save' | 'issue'>('save');
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  const form = useForm<NewSnaggingListFormValues>({
    resolver: zodResolver(SnaggingListSchema),
    defaultValues: { projectId: '', areaId: '', title: '', description: '', status: 'issued' },
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
    if (selectedAreaId === 'other') {
      form.setValue('title', 'Manual Snag List: ');
    } else if (selectedAreaId && selectedAreaId !== 'none' && selectedAreaId !== '') {
      const area = availableAreas.find(a => a.id === selectedAreaId);
      if (area) {
        form.setValue('title', `${area.name} Completion Snags`);
      }
    }
  }, [selectedAreaId, availableAreas, form]);

  const handleAddItem = () => {
    if (!newItemText.trim() && pendingItemPhotos.length === 0) return;

    const newItem = sanitizeSnagItem({
      id: `item-${Date.now()}`,
      description: newItemText.trim() || 'No description',
      status: 'open',
      photos: [...pendingItemPhotos],
      subContractorId: (pendingSubId === 'unassigned' || !pendingSubId) ? null : pendingSubId,
    });

    setItems([...items, newItem]);
    setNewItemText('');
    setPendingItemPhotos([]);
    setPendingSubId(undefined);
  };

  const handleStartEditItem = (idx: number) => {
    const item = items[idx];
    setEditingItemIdx(idx);
    setEditItemText(item.description);
    setEditItemSubId(item.subContractorId || undefined);
  };

  const handleSaveEditItem = (idx: number) => {
    setItems(items.map((it, i) => i === idx ? sanitizeSnagItem({ ...it, description: editItemText, subContractorId: (editItemSubId === 'unassigned' || !editItemSubId) ? null : editItemSubId }) : it));
    setEditingItemIdx(null);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleToggleStatus = (idx: number) => {
    setItems(items.map((it, i) => i === idx ? sanitizeSnagItem({ ...it, status: (it.status === 'open' ? 'closed' : 'open') as any }) : it));
  };

  const onCaptureGeneral = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  };

  const onCaptureItem = (photo: Photo) => {
    if (itemPhotoTargetIdx !== null) {
        setItems(prev => prev.map((itm, i) => i === itemPhotoTargetIdx ? { ...itm, photos: [...(itm.photos || []), photo] } : itm));
        setItemPhotoTargetIdx(null);
    } else {
        setPendingItemPhotos(prev => [...prev, photo]);
    }
  };

  const hasUnsavedChanges = items.length > 0 || photos.length > 0 || (form.watch('title') && form.watch('title').length > 5);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardAlert(true);
    } else {
      setOpen(false);
    }
  };

  const onSubmit = (values: NewSnaggingListFormValues) => {
    const isIssuing = submitMode === 'issue';
    const isDrafting = submitMode === 'draft';

    if (items.length === 0) {
        toast({ title: 'List Empty', description: 'Add at least one snagging item before saving.', variant: 'destructive' });
        return;
    }

    if (isIssuing && !allUsers) {
        toast({ title: 'System Loading', description: 'User registry is still syncing. Please wait a moment and try again.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        // 1. Check for existing list in this area to enforce "One List Per Area" rule
        const normalizedAreaId = values.areaId === 'none' ? null : (values.areaId || null);
        const existingList = allSnaggingLists.find(l => 
            l.projectId === values.projectId && 
            l.areaId === normalizedAreaId
        );

        toast({ title: existingList ? 'Merging Records' : 'Recording', description: 'Processing visual documentation...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/general/${Date.now()}-${i}.jpg`, blob);
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
            
            return sanitizeSnagItem({
                ...snag,
                photos: updatedPhotos
            });
        }));

        const targetStatus = isIssuing ? 'issued' : (isDrafting ? 'draft' : values.status);

        if (existingList) {
            // MERGE Logic
            const docRef = doc(db, 'snagging-items', existingList.id);
            await updateDoc(docRef, {
                items: arrayUnion(...uploadedItems),
                photos: arrayUnion(...uploadedPhotos),
                status: targetStatus === 'issued' ? 'issued' : existingList.status
            });
            toast({ title: 'Items Merged', description: `Added to existing list for ${existingList.title}.` });
        } else {
            // CREATE Logic
            const initials = getProjectInitials(selectedProject?.name || 'PRJ');
            const existingRefs = allSnaggingLists.map(l => ({ reference: l.reference, projectId: l.projectId }));
            const reference = getNextReference(existingRefs, values.projectId, 'SNAG', initials);

            const snagData = {
              reference,
              projectId: values.projectId,
              areaId: normalizedAreaId,
              title: values.title,
              description: values.description || null,
              items: uploadedItems,
              photos: uploadedPhotos,
              status: targetStatus,
              createdAt: new Date().toISOString(),
              createdByEmail: sessionEmail || 'Unknown'
            };

            await addDoc(collection(db, 'snagging-items'), snagData);
            toast({ title: 'Success', description: isDrafting ? 'Draft snag list saved.' : 'Snagging record created.' });
        }

        if (isIssuing && allUsers) {
            toast({ title: 'Distributing', description: 'Generating trade-specific reports...' });
            const area = selectedProject?.areas?.find(a => a.id === values.areaId);
            const subIds = Array.from(new Set(uploadedItems.map(i => i.subContractorId).filter(id => !!id))) as string[];
            let sentCount = 0;

            for (const subId of subIds) {
                const sub = subContractors.find(s => s.id === subId);
                const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
                
                if (sub && recipientEmails.length > 0) {
                    const myItems = uploadedItems.filter(i => i.subContractorId === subId);
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
                        scopeLabel: `Trade: ${sub.name} (New Assignment)`
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
                            title: `Send Failed (${sub.name})`, 
                            description: result.message || 'Check your email configuration.', 
                            variant: 'destructive' 
                        });
                    }
                }
            }
            if (sentCount > 0) {
                toast({ title: 'Distribution Done', description: `${sentCount} trade partners notified.` });
            }
        }

        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to record snagging data. Check connection.', variant: 'destructive' });
      }
    });
  };

  const localUnsyncedCount = items.reduce((acc, itm) => acc + (itm.photos || []).length, 0) + photos.length;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => { if(!val) handleRequestClose(); else setOpen(true); }}>
        <DialogTrigger asChild><Button className="font-bold"><PlusCircle className="mr-2 h-4 w-4" />New List</Button></DialogTrigger>
        <DialogContent 
          className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0 flex items-center justify-between">
              <div>
                <DialogTitle>Create Snagging List</DialogTitle>
                <DialogDescription>Capture defects instantly. All items are held in local staging until you Save.</DialogDescription>
              </div>
              {localUnsyncedCount > 0 && (
                  <Badge variant="secondary" className="gap-2 h-7 px-3 bg-primary/10 text-primary border-primary/20 animate-in fade-in">
                      <CloudUpload className="h-3.5 w-3.5" />
                      {localUnsyncedCount} Items Staged
                  </Badge>
              )}
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-6">
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(() => {}, () => scrollToFirstError())} className="space-y-8">
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
                                    <FormLabel>Area / Plot</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                                      </FormControl>
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
                              <FormItem><FormLabel>List Identification</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                          )} />
                      </div>

                      <div className="space-y-4">
                          <div className="flex justify-between items-center"><FormLabel className="font-black text-xs uppercase text-muted-foreground tracking-widest">Identify Defects</FormLabel><VoiceInput onResult={setNewItemText} /></div>
                          <div className="flex gap-2 items-end bg-background p-4 rounded-xl border shadow-sm">
                              <div className="flex-1 space-y-2">
                                  <div className="flex justify-between items-center">
                                      <Label className="text-[10px] font-bold">New Defect</Label>
                                      <VoiceInput onResult={setNewItemText} />
                                  </div>
                                  <Input placeholder="Describe the issue..." value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}} className="bg-background" />
                              </div>
                              <div className="flex gap-1">
                                  <Select value={pendingSubId || 'unassigned'} onValueChange={setPendingSubId}>
                                      <SelectTrigger className={cn("px-2 border-none h-11 transition-all", pendingSubId ? "w-auto" : "w-10 justify-center")}>
                                          <div className="flex items-center gap-2">
                                              {pendingSubId !== 'unassigned' && pendingSubId ? (
                                                  <Badge variant="secondary" className="hidden md:block h-6 text-[9px] font-black max-w-[100px] truncate uppercase">{projectSubs.find(s => s.id === pendingSubId)?.name}</Badge>
                                              ) : <UserPlus className="h-4 w-4 text-primary" />}
                                          </div>
                                      </SelectTrigger>
                                      <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Button type="button" variant="outline" className="h-11" onClick={() => setIsItemCameraOpen(true)}><Camera className="h-5 w-5 text-primary" /></Button>
                                  <Button type="button" size="icon" className="h-11 rounded-lg" onClick={handleAddItem} disabled={isPending}>
                                      {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                  </Button>
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
                              {items.map((item, idx) => (
                                  <div key={item.id} className="bg-white p-4 rounded-xl border shadow-sm group animate-in fade-in transition-all">
                                      {editingItemIdx === idx ? (
                                          <div className="space-y-4">
                                              <Input value={editItemText} onChange={e => setEditItemText(e.target.value)} className="h-9" autoFocus />
                                              <div className="flex justify-between items-center">
                                                  <Select value={editItemSubId || 'unassigned'} onValueChange={setEditItemSubId}>
                                                      <SelectTrigger className="w-40 h-8 text-[10px] uppercase font-bold"><SelectValue placeholder="Assign" /></SelectTrigger>
                                                      <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                  </Select>
                                                  <div className="flex gap-1">
                                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setItemPhotoTargetIdx(idx)}><Camera className="h-4 w-4" /></Button>
                                                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingItemIdx(null)}>Cancel</Button>
                                                      <Button type="button" size="sm" onClick={() => handleSaveEditItem(idx)}><Check className="h-4 w-4 mr-1.5" /> Done</Button>
                                                  </div>
                                              </div>
                                          </div>
                                      ) : (
                                          <div className="flex items-start justify-between gap-3">
                                              <div className="flex-1 min-w-0">
                                                  <span className="text-sm font-bold truncate block">{item.description}</span>
                                                  <div className="mt-1 flex items-center gap-2">
                                                      {item.subContractorId && <Badge variant="secondary" className="text-[10px] font-black h-4 px-1.5">{projectSubs.find(s => s.id === item.subContractorId)?.name}</Badge>}
                                                      {item.photos && item.photos.length > 0 && <span className="text-[9px] text-muted-foreground flex items-center gap-1"><Camera className="h-2 w-2" /> {item.photos.length} Photo evidence</span>}
                                                  </div>
                                              </div>
                                              <div className="flex gap-1">
                                                  <button type="button" onClick={() => handleToggleStatus(idx)} className="mt-1 flex-shrink-0 transition-transform active:scale-90">
                                                      {item.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                                  </button>
                                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleStartEditItem(idx)}><Pencil className="h-4 w-4" /></Button>
                                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(idx)}><Trash2 className="h-4 w-4" /></Button>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                          <FormLabel className="font-black text-xs uppercase text-muted-foreground tracking-widest">Global List Photos</FormLabel>
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
                            <CheckCircle2 className="h-4 w-4" /> Save List
                        </Button>
                        <Button 
                            type="button" 
                            className="w-full sm:flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20 gap-2" 
                            disabled={isPending} 
                            onClick={() => { setSubmitMode('issue'); form.handleSubmit((v) => onSubmit(v))(); }}
                        >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Sync & Send Reports
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
              You have captured data or defect photos that haven't been saved to the cloud. Closing will permanently delete this progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscardAlert(false)}>Stay in List</AlertDialogCancel>
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
        isOpen={isItemCameraOpen || itemPhotoTargetIdx !== null} 
        onClose={() => { setIsItemCameraOpen(false); setItemPhotoTargetIdx(null); }} 
        onCapture={onCaptureItem}
        title="Specific Defect Documentation"
      />
    </>
  );
}
