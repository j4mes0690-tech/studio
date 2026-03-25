'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  PlusCircle, 
  Loader2, 
  Save, 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Thermometer, 
  UserPlus, 
  Users, 
  Trash2, 
  MapPin, 
  Camera,
  X,
  Pencil,
  Check,
  AlertTriangle,
  Maximize2,
  Upload
} from 'lucide-react';
import type { Project, DistributionUser, SubContractor, SiteDiaryEntry, SubcontractorLog, Photo } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CameraOverlay } from '@/components/camera-overlay';
import { VoiceInput } from '@/components/voice-input';
import { dataUriToBlob, uploadFile, optimizeImage } from '@/lib/storage-utils';
import Image from 'next/image';
import { cn, scrollToFirstError } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';

const NewDiarySchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  date: z.string().min(1, 'Date is required.'),
  weatherCondition: z.string().min(1, 'Weather condition is required.'),
  temp: z.coerce.number().optional(),
  generalComments: z.string().optional(),
});

type NewDiaryFormValues = z.infer<typeof NewDiarySchema>;

const WEATHER_CONDITIONS = [
  { label: 'Sunny', icon: Sun },
  { label: 'Cloudy', icon: Cloud },
  { label: 'Rain', icon: CloudRain },
  { label: 'Windy', icon: Wind },
  { label: 'Mixed', icon: CloudRain },
];

export function NewDiaryEntry({ projects, subContractors, currentUser }: { 
  projects: Project[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [activeDiaryId, setActiveDiaryId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Omit<SubcontractorLog, 'id'>[]>([]);
  const [editingLogIdx, setEditingLogIdx] = useState<number | null>(null);
  const [pendingSubId, setPendingSubId] = useState<string>('');
  const [pendingQty, setPendingQty] = useState<number>(1);
  const [pendingAreaId, setPendingAreaId] = useState<string>('none');
  const [pendingNotes, setPendingNotes] = useState<string>('');

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Warning State
  const [showLabourWarning, setShowLabourWarning] = useState(false);
  const [pendingValues, setPendingValues] = useState<NewDiaryFormValues | null>(null);

  const form = useForm<NewDiaryFormValues>({
    resolver: zodResolver(NewDiarySchema),
    defaultValues: {
      projectId: '',
      date: new Date().toISOString().split('T')[0],
      weatherCondition: 'Sunny',
      temp: 15,
      generalComments: '',
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const availableAreas = selectedProject?.areas || [];
  
  const projectSubs = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => assignedIds.includes(sub.id));
  }, [selectedProjectId, selectedProject, subContractors]);

  const ensureDiaryCreated = async (): Promise<string | null> => {
    if (activeDiaryId) return activeDiaryId;
    
    const values = form.getValues();
    if (!values.projectId) {
        toast({ title: 'Project Required', description: 'Select a project before capturing photos.', variant: 'destructive' });
        return null;
    }

    const diaryData = {
      projectId: values.projectId,
      date: values.date,
      weather: {
        condition: values.weatherCondition,
        temp: values.temp,
      },
      subcontractorLogs: logs as any,
      generalComments: values.generalComments || '',
      photos: [],
      createdAt: new Date().toISOString(),
      createdByEmail: currentUser.email.toLowerCase().trim(),
    };

    const docRef = await addDoc(collection(db, 'site-diary'), diaryData);
    setActiveDiaryId(docRef.id);
    return docRef.id;
  };

  const handleMetadataBlur = async () => {
    if (activeDiaryId) {
        const values = form.getValues();
        await updateDoc(doc(db, 'site-diary', activeDiaryId), {
            projectId: values.projectId,
            date: values.date,
            weather: {
                condition: values.weatherCondition,
                temp: values.temp,
            },
            generalComments: values.generalComments || '',
        });
    }
  };

  const handleAddLabour = async () => {
    if (!pendingSubId) return;
    const sub = subContractors.find(s => s.id === pendingSubId);
    const area = availableAreas.find(a => a.id === pendingAreaId);

    const newLog = {
      subcontractorId: pendingSubId,
      subcontractorName: sub?.name || 'Unknown',
      operativeCount: pendingQty,
      areaId: pendingAreaId === 'none' ? null : pendingAreaId,
      areaName: pendingAreaId === 'none' ? 'Site Wide' : (area?.name || null),
      notes: pendingNotes,
    };

    let updatedLogs: Omit<SubcontractorLog, 'id'>[] = [];
    if (editingLogIdx !== null) {
      updatedLogs = [...logs];
      updatedLogs[editingLogIdx] = newLog;
      setLogs(updatedLogs);
      setEditingLogIdx(null);
    } else {
      updatedLogs = [...logs, newLog];
      setLogs(updatedLogs);
    }

    if (activeDiaryId) {
        await updateDoc(doc(db, 'site-diary', activeDiaryId), {
            subcontractorLogs: updatedLogs as any
        });
    }

    setPendingSubId('');
    setPendingNotes('');
    setPendingQty(1);
    setPendingAreaId('none');
  };

  const handleEditLabour = (idx: number) => {
    const log = logs[idx];
    setPendingSubId(log.subcontractorId);
    setPendingQty(log.operativeCount);
    setPendingAreaId(log.areaId || 'none');
    setPendingNotes(log.notes);
    setEditingLogIdx(idx);
  };

  const removeLabour = async (idx: number) => {
    const updatedLogs = logs.filter((_, i) => i !== idx);
    setLogs(updatedLogs);
    if (activeDiaryId) {
        await updateDoc(doc(db, 'site-diary', activeDiaryId), {
            subcontractorLogs: updatedLogs as any
        });
    }
    if (editingLogIdx === idx) setEditingLogIdx(null);
  };

  const onCapture = (photo: Photo) => {
    startTransition(async () => {
      try {
        const diaryId = await ensureDiaryCreated();
        if (!diaryId) return;

        const blob = await dataUriToBlob(photo.url);
        const url = await uploadFile(storage, `site-diary/photos/${diaryId}-${Date.now()}.jpg`, blob);
        const updatedPhoto = { ...photo, url };
        
        await updateDoc(doc(db, 'site-diary', diaryId), {
          photos: arrayUnion(updatedPhoto)
        });
        
        setPhotos(prev => [...prev, updatedPhoto]);
        toast({ title: 'Photo Saved', description: 'Autosave active.' });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to autosave photo.', variant: 'destructive' });
      }
    });
    setIsCameraOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach(f => {
      const reader = new FileReader();
      reader.onload = async (re) => {
        startTransition(async () => {
          try {
            const diaryId = await ensureDiaryCreated();
            if (!diaryId) return;

            const dataUri = re.target?.result as string;
            const optimized = await optimizeImage(dataUri);
            const blob = await dataUriToBlob(optimized);
            const url = await uploadFile(storage, `site-diary/photos/${diaryId}-${Date.now()}.jpg`, blob);
            
            const newPhoto = { url, takenAt: new Date().toISOString() };
            
            await updateDoc(doc(db, 'site-diary', diaryId), {
              photos: arrayUnion(newPhoto)
            });
            
            setPhotos(prev => [...prev, newPhoto]);
          } catch (err) {
            toast({ title: 'Sync Error', description: 'Failed to upload image.', variant: 'destructive' });
          }
        });
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== idx);
    setPhotos(updatedPhotos);
    if (activeDiaryId) {
        updateDoc(doc(db, 'site-diary', activeDiaryId), { photos: updatedPhotos });
    }
  };

  const onSubmit = (values: NewDiaryFormValues) => {
    if (logs.length === 0) {
      setPendingValues(values);
      setShowLabourWarning(true);
    } else {
      executeSave(values);
    }
  };

  const executeSave = (values: NewDiaryFormValues) => {
    startTransition(async () => {
      try {
        if (activeDiaryId) {
            await updateDoc(doc(db, 'site-diary', activeDiaryId), {
                projectId: values.projectId,
                date: values.date,
                weather: {
                    condition: values.weatherCondition,
                    temp: values.temp,
                },
                subcontractorLogs: logs as any,
                generalComments: values.generalComments || '',
            });
        } else {
            const uploadedPhotos = await Promise.all(
                photos.map(async (p, i) => {
                    if (p.url.startsWith('data:')) {
                        const blob = await dataUriToBlob(p.url);
                        const url = await uploadFile(storage, `site-diary/photos/${Date.now()}-${i}.jpg`, blob);
                        return { ...p, url };
                    }
                    return p;
                })
            );

            const diaryData: Omit<SiteDiaryEntry, 'id'> = {
                projectId: values.projectId,
                date: values.date,
                weather: {
                    condition: values.weatherCondition,
                    temp: values.temp,
                },
                subcontractorLogs: logs as any,
                generalComments: values.generalComments || '',
                photos: uploadedPhotos,
                createdAt: new Date().toISOString(),
                createdByEmail: currentUser.email.toLowerCase().trim(),
            };

            await addDoc(collection(db, 'site-diary'), diaryData);
        }
        
        toast({ title: 'Success', description: 'Site diary entry finalized.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save entry.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setLogs([]);
      setPhotos([]);
      setActiveDiaryId(null);
      setEditingLogIdx(null);
      setShowLabourWarning(false);
      setPendingValues(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 h-10 px-5 shadow-lg shadow-primary/20 font-bold">
            <PlusCircle className="h-4 w-4" />
            Record Daily Log
          </Button>
        </DialogTrigger>
        <DialogContent 
          className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0 flex flex-row items-center justify-between">
            <div>
                <DialogTitle>Site Diary Record</DialogTitle>
                <DialogDescription>Daily summary of weather, trade resources, and activities.</DialogDescription>
            </div>
            {activeDiaryId && (
                <div className="hidden sm:block">
                    <Badge variant="secondary" className="font-mono text-[10px] animate-pulse">AUTOSAVE ACTIVE</Badge>
                </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-muted/5">
            <Form {...form}>
              <form className="space-y-8">
                <div className="bg-background p-6 rounded-xl border shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="projectId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); handleMetadataBlur(); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Log Date</FormLabel><FormControl><Input type="date" {...field} onBlur={handleMetadataBlur} /></FormControl></FormItem>
                    )} />
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="weatherCondition" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weather Condition</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); handleMetadataBlur(); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {WEATHER_CONDITIONS.map(w => (
                              <SelectItem key={w.label} value={w.label}>
                                <div className="flex items-center gap-2">
                                  <w.icon className="h-4 w-4" />
                                  {w.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="temp" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperature (°C)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Thermometer className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input type="number" className="pl-9" {...field} onBlur={handleMetadataBlur} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <FormLabel className="text-primary font-bold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Labour & Trade Resources
                  </FormLabel>
                  <div className={cn(
                    "bg-muted/30 p-4 rounded-lg border space-y-4 transition-colors",
                    editingLogIdx !== null && "border-primary bg-primary/5"
                  )}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Trade Partner</Label>
                        <Select value={pendingSubId} onValueChange={setPendingSubId} disabled={!selectedProjectId}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select sub-contractor" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Operative Count</Label>
                          <Input type="number" min="1" value={pendingQty} onChange={e => setPendingQty(parseInt(e.target.value) || 1)} className="bg-background" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Location</Label>
                          <Select value={pendingAreaId} onValueChange={setPendingAreaId} disabled={!selectedProjectId}>
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Site Wide</SelectItem>
                              {availableAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Activity Description / Notes</Label>
                      <Input placeholder="What are they working on?" value={pendingNotes} onChange={e => setPendingNotes(e.target.value)} className="bg-background" />
                    </div>
                    <div className="flex gap-2">
                        {editingLogIdx !== null && (
                            <Button type="button" variant="ghost" onClick={() => {
                                setEditingLogIdx(null);
                                setPendingSubId('');
                                setPendingNotes('');
                                setPendingQty(1);
                                setPendingAreaId('none');
                            }}>Cancel</Button>
                        )}
                        <Button type="button" variant={editingLogIdx !== null ? "default" : "secondary"} className="flex-1 font-bold" onClick={handleAddLabour} disabled={!pendingSubId}>
                            {editingLogIdx !== null ? <><Check className="h-4 w-4 mr-2" /> Update Labour Line</> : <><UserPlus className="h-4 w-4 mr-2" /> Add Trade Resource</>}
                        </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {logs.map((log, idx) => (
                      <div key={idx} className={cn(
                        "flex items-center justify-between p-3 rounded border bg-background shadow-sm animate-in fade-in transition-all",
                        editingLogIdx === idx && "ring-2 ring-primary border-transparent"
                      )}>
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-primary truncate">{log.subcontractorName}</p>
                            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-black">{log.operativeCount} PERS</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {log.areaName}</span>
                            {log.notes && <span className="truncate italic">• {log.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEditLabour(idx)}><Pencil className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLabour(idx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-background p-6 rounded-xl border shadow-sm space-y-4">
                  <FormField control={form.control} name="generalComments" render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>General Site Comments</FormLabel>
                        <VoiceInput onResult={(text) => { field.onChange(text); handleMetadataBlur(); }} />
                      </div>
                      <FormControl><Textarea placeholder="Major activities, deliveries, or safety observations..." className="min-h-[100px]" {...field} onBlur={handleMetadataBlur} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 bg-background p-6 rounded-xl border shadow-sm">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-sm font-bold">Daily Visual Records</FormLabel>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">Stored in real-time</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-24 h-24 group cursor-pointer" onClick={() => setViewingPhoto(p)}>
                        <Image src={p.url} alt="Site" fill className="rounded-xl object-cover border-2" />
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                            <Maximize2 className="h-4 w-4 text-white" />
                        </div>
                        <button 
                          type="button" 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg z-10" 
                          onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => setIsCameraOpen(true)}>
                      <Camera className="h-6 w-6 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase">Camera</span>
                    </Button>
                    <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-xl border-dashed" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = (e: any) => handleFileSelect(e);
                        input.click();
                    }}>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase">Upload</span>
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          <DialogFooter className="p-6 bg-white border-t shrink-0">
            <Button className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" onClick={form.handleSubmit(onSubmit, () => scrollToFirstError())} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showLabourWarning} onOpenChange={setShowLabourWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                <AlertDialogTitle>Missing Labour Data</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground">
              You haven't added any trade partners or operatives to this daily log.
              <br /><br />
              Site diaries without workforce data provide a less accurate record for commercial audits. Are you sure you want to save?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLabourWarning(false)}>Go Back</AlertDialogCancel>
            <AlertDialogAction 
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                    if (pendingValues) executeSave(pendingValues);
                    setShowLabourWarning(false);
                }}
            >
                Confirm Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture} 
        title="Site Progress Documentation"
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
