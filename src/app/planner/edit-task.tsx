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
import { Loader2, Save, HardHat, Link as LinkIcon, Camera, X, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import type { Project, Trade, PlannerTask, Photo } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadFile, dataUriToBlob, optimizeImage } from '@/lib/storage-utils';
import { addDays, parseISO, format, isValid, differenceInDays } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const EditTaskSchema = z.object({
  title: z.string().min(3, 'Description of work is required.'),
  tradeId: z.string().min(1, 'Trade is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day.'),
  status: z.enum(['pending', 'in-progress', 'completed']),
  actualCompletionDate: z.string().optional().nullable(),
  predecessorIds: z.array(z.string()).default([]),
});

type EditTaskFormValues = z.infer<typeof EditTaskSchema>;

export function EditTaskDialog({ 
  task,
  projects, 
  trades, 
  allTasks, 
  open,
  onOpenChange
}: { 
  task: PlannerTask;
  projects: Project[]; 
  trades: Trade[]; 
  allTasks: PlannerTask[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>(task.photos || []);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(EditTaskSchema),
    defaultValues: {
      title: task.title,
      tradeId: task.tradeId,
      startDate: task.startDate,
      durationDays: task.durationDays,
      status: task.status,
      actualCompletionDate: task.actualCompletionDate || null,
      predecessorIds: task.predecessorIds || [],
    },
  });

  useEffect(() => {
    if (open && task) {
      form.reset({
        title: task.title,
        tradeId: task.tradeId,
        startDate: task.startDate,
        durationDays: task.durationDays,
        status: task.status,
        actualCompletionDate: task.actualCompletionDate || null,
        predecessorIds: task.predecessorIds || [],
      });
      setPhotos(task.photos || []);
    }
  }, [open, task, form]);

  const selectedProject = useMemo(() => projects.find(p => p.id === task.projectId), [projects, task.projectId]);
  const potentialPredecessors = useMemo(() => {
    return allTasks.filter(t => t.projectId === task.projectId && t.areaId === task.areaId && t.id !== task.id);
  }, [allTasks, task.projectId, task.areaId, task.id]);

  // REFORECASTING LOGIC
  const reforecast = (currentTaskId: string, newFinishDate: Date, allProjectTasks: PlannerTask[], batch: any) => {
    const successors = allProjectTasks.filter(t => t.predecessorIds.includes(currentTaskId));
    
    successors.forEach(successor => {
      // Successor starts the day after the predecessor finishes
      const idealStart = addDays(newFinishDate, 1);
      const idealStartStr = format(idealStart, 'yyyy-MM-dd');

      if (successor.startDate !== idealStartStr) {
        const docRef = doc(db, 'planner-tasks', successor.id);
        batch.update(docRef, { startDate: idealStartStr });
        
        // Recursive call: successors of this successor
        const successorFinish = addDays(idealStart, successor.durationDays - 1);
        reforecast(successor.id, successorFinish, allProjectTasks, batch);
      }
    });
  };

  const onSubmit = (values: EditTaskFormValues) => {
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

        const batch = writeBatch(db);
        const taskRef = doc(db, 'planner-tasks', task.id);
        
        const updates = {
          ...values,
          photos: uploadedPhotos,
        };

        batch.update(taskRef, updates);

        // Check if we need to reforecast
        const currentFinish = values.actualCompletionDate 
            ? parseISO(values.actualCompletionDate) 
            : addDays(parseISO(values.startDate), values.durationDays - 1);
        
        reforecast(task.id, currentFinish, allTasks, batch);

        await batch.commit();
        toast({ title: 'Task Updated', description: 'Schedule reforecasted based on changes.' });
        onOpenChange(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update schedule.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
        await deleteDoc(doc(db, 'planner-tasks', task.id));
        toast({ title: 'Task Deleted', description: 'Item removed from schedule.' });
        onOpenChange(false);
    });
  }

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

  const currentStatus = form.watch('status');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start pr-8">
            <div>
                <DialogTitle>Edit Task Details</DialogTitle>
                <DialogDescription>Adjust forecast or record actual completion.</DialogDescription>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete Task?</AlertDialogTitle><AlertDialogDescription>This will remove the task and break any downstream dependency links.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete Task</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Activity Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="tradeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Responsible Trade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{trades.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Live Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>Forecast Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="durationDays" render={({ field }) => (
                        <FormItem><FormLabel>Planned Days</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                    )} />
                </div>
                {currentStatus === 'completed' && (
                    <FormField control={form.control} name="actualCompletionDate" render={({ field }) => (
                        <FormItem className="animate-in fade-in bg-green-50 p-3 rounded border border-green-100">
                            <FormLabel className="text-green-800 font-bold">Actual Completion Date</FormLabel>
                            <FormControl><Input type="date" value={field.value || ''} onChange={field.onChange} className="bg-white border-green-200" /></FormControl>
                            <FormDescription className="text-[10px] text-green-700">Reforecasting will pivot from this date.</FormDescription>
                        </FormItem>
                    )} />
                )}
            </div>

            <Separator />

            <div className="space-y-4">
                <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Task Documentation</FormLabel>
                <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                        <div key={i} className="relative w-20 h-20 rounded border overflow-hidden">
                            <Image src={p.url} alt="Site" fill className="object-cover" />
                            <button type="button" className="absolute top-0 right-0 bg-destructive text-white p-0.5" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}>
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => setIsCameraOpen(true)}>
                        <Camera className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[8px] font-bold">Capture</span>
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
                <FormLabel className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-primary" /> Successor Logic (Predecessors)</FormLabel>
                <ScrollArea className="h-32 rounded-md border p-3 bg-muted/5">
                    {potentialPredecessors.map((pTask) => (
                        <FormField
                            key={pTask.id}
                            control={form.control}
                            name="predecessorIds"
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value?.includes(pTask.id)}
                                            onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...(field.value || []), pTask.id])
                                                    : field.onChange(field.value?.filter((v) => v !== pTask.id));
                                            }}
                                        />
                                    </FormControl>
                                    <FormLabel className="text-xs font-medium cursor-pointer">{pTask.title}</FormLabel>
                                </FormItem>
                            )}
                        />
                    ))}
                </ScrollArea>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Commit & Reforecast
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
