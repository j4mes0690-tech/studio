'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Save, HardHat, Layers, Calendar, Link as LinkIcon, Camera, Upload, X, RefreshCw } from 'lucide-react';
import type { Project, SubContractor, PlannerTask, Photo } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { addDays, parseISO, format, isValid } from 'date-fns';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';
import { parseDateString, calculateFinishDate, calculateNextStartDate } from '@/lib/utils';

const NewTaskSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  plannerId: z.string().min(1, 'Planner selection is required.'),
  title: z.string().min(3, 'Description of work is required.'),
  subcontractorId: z.string().min(1, 'Assigned partner is required.'),
  customSubcontractorName: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required.'),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day.').default(1),
  predecessorIds: z.array(z.string()).default([]),
});

type NewTaskFormValues = z.infer<typeof NewTaskSchema>;

export function NewTaskDialog({ 
  projects, 
  subContractors, 
  allTasks, 
  initialProjectId,
  initialPlannerId
}: { 
  projects: Project[]; 
  subContractors: SubContractor[]; 
  allTasks: PlannerTask[];
  initialProjectId?: string | null;
  initialPlannerId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<NewTaskFormValues>({
    resolver: zodResolver(NewTaskSchema),
    defaultValues: {
      projectId: initialProjectId || '',
      plannerId: initialPlannerId || '',
      title: '',
      subcontractorId: '',
      customSubcontractorName: '',
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 1,
      predecessorIds: [],
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedPlannerId = form.watch('plannerId');
  const selectedPredecessorIds = form.watch('predecessorIds');
  const selectedSubId = form.watch('subcontractorId');
  
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const currentPlanner = useMemo(() => {
    return [...(selectedProject?.planners || []), ...(selectedProject?.areas || [])].find(p => p.id === selectedPlannerId);
  }, [selectedProject, selectedPlannerId]);

  const availablePartners = useMemo(() => {
    if (!selectedProject || !subContractors) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(sub => assignedIds.includes(sub.id));
  }, [selectedProject, subContractors]);

  useEffect(() => {
    if (selectedPredecessorIds && selectedPredecessorIds.length > 0) {
      const selectedPredecessors = allTasks.filter(t => selectedPredecessorIds.includes(t.id));
      
      if (selectedPredecessors.length > 0) {
        const sat = !!currentPlanner?.includeSaturday;
        const sun = !!currentPlanner?.includeSunday;
        
        let latestFinishDateStr: string | null = null;
        let latestFinishDateObj: Date | null = null;

        selectedPredecessors.forEach(p => {
          const pFinishStr = p.status === 'completed' && p.actualCompletionDate 
            ? p.actualCompletionDate 
            : calculateFinishDate(p.startDate, p.durationDays, sat, sun);
          
          const pFinishObj = parseDateString(pFinishStr);
          
          if (isValid(pFinishObj)) {
            if (!latestFinishDateObj || pFinishObj > latestFinishDateObj) {
              latestFinishDateObj = pFinishObj;
              latestFinishDateStr = pFinishStr;
            }
          }
        });

        if (latestFinishDateStr) {
          const nextStartStr = calculateNextStartDate(latestFinishDateStr, sat, sun);
          form.setValue('startDate', nextStartStr);
        }
      }
    }
  }, [selectedPredecessorIds, allTasks, form, currentPlanner]);

  const potentialPredecessors = useMemo(() => {
    if (!selectedProjectId || !selectedPlannerId) return [];
    return allTasks.filter(t => t.projectId === selectedProjectId && (t.plannerId === selectedPlannerId || t.areaId === selectedPlannerId));
  }, [allTasks, selectedProjectId, selectedPlannerId]);

  const onSubmit = (values: NewTaskFormValues) => {
    startTransition(async () => {
      try {
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `planner/tasks/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const taskData: Omit<PlannerTask, 'id'> = {
          projectId: values.projectId,
          plannerId: values.plannerId,
          areaId: values.plannerId,
          title: values.title,
          subcontractorId: values.subcontractorId,
          customSubcontractorName: values.customSubcontractorName || null,
          startDate: values.startDate,
          durationDays: values.durationDays,
          predecessorIds: values.predecessorIds || [],
          originalStartDate: values.startDate,
          originalDurationDays: values.durationDays,
          actualCompletionDate: null,
          status: 'pending',
          photos: uploadedPhotos,
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'planner-tasks'), taskData);
        toast({ title: 'Activity Scheduled', description: 'Task added to the sequence.' });
        
        form.reset({
            ...values,
            title: '',
            predecessorIds: [],
        });
        setPhotos([]);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to schedule task.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (open) {
        form.reset({
            projectId: initialProjectId || '',
            plannerId: initialPlannerId || '',
            title: '',
            subcontractorId: '',
            customSubcontractorName: '',
            startDate: new Date().toISOString().split('T')[0],
            durationDays: 1,
            predecessorIds: [],
        });
        setPhotos([]);
    }
  }, [open, initialProjectId, initialPlannerId, form]);

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

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const raw = canvas.toDataURL('image/jpeg', 0.85);
      const optimized = await optimizeImage(raw);
      setPhotos([...photos, { url: optimized, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-bold"><PlusCircle className="h-4 w-4" />Log Task</Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Log Construction Activity</DialogTitle>
          <DialogDescription>Define sequence and responsibility for this task.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!initialProjectId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger></FormControl>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="plannerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Planner</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!initialPlannerId || !selectedProjectId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose schedule" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {[...(selectedProject?.planners || []), ...(selectedProject?.areas || [])].map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center"><FormLabel>Activity Description</FormLabel><VoiceInput onResult={field.onChange} /></div>
                <FormControl><Input placeholder="e.g. Install first fix plumbing" {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="subcontractorId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assigned Trade Partner</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                            <FormControl><SelectTrigger><SelectValue placeholder={availablePartners.length > 0 ? "Select assigned partner" : "No partners assigned to project"} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {availablePartners.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                <Separator className="my-1" />
                                <SelectItem value="other">Other (Manual Entry)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormDescription className="text-[10px]">Only subcontractors assigned to this project are available.</FormDescription>
                    </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="durationDays" render={({ field }) => (
                        <FormItem><FormLabel>Duration (Days)</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            {selectedSubId === 'other' && (
                <FormField control={form.control} name="customSubcontractorName" render={({ field }) => (
                    <FormItem className="animate-in fade-in slide-in-from-top-2 bg-primary/5 p-4 rounded-lg border-2 border-primary/20">
                        <FormLabel className="text-primary font-bold">Custom Trade Partner Name</FormLabel>
                        <FormControl><Input placeholder="Enter trade partner name..." {...field} className="bg-background" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            )}

            <div className="space-y-4">
                <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Site Context (Photos)</FormLabel>
                <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg border overflow-hidden">
                            <Image src={p.url} alt="Context" fill className="object-cover" />
                            <button type="button" className="absolute top-0 right-0 bg-destructive text-white p-0.5" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}>
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed rounded-lg" onClick={() => setIsCameraOpen(true)}>
                        <Camera className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[8px] font-black uppercase">Photo</span>
                    </Button>
                </div>
                {isCameraOpen && (
                    <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                        <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                        <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={capturePhoto}>Capture</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <FormLabel className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Critical Path Predecessors
                </FormLabel>
                <ScrollArea className="h-32 rounded-md border p-3 bg-muted/5">
                    {potentialPredecessors.length > 0 ? potentialPredecessors.map((task) => (
                        <FormField
                            key={task.id}
                            control={form.control}
                            name="predecessorIds"
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value?.includes(task.id)}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...(field.value || []), task.id])
                                                    : field.onChange(field.value?.filter((v) => v !== task.id));
                                            }}
                                        />
                                    </FormControl>
                                    <FormLabel className="text-xs font-medium cursor-pointer">
                                        {task.title}
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                    )) : (
                        <p className="text-[10px] text-muted-foreground italic text-center py-8">No other tasks in this planner yet.</p>
                    )}
                </ScrollArea>
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Close</Button>
              <Button type="submit" className="flex-1 h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Add & Continue
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
