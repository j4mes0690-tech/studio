
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Save, HardHat, Layers, Calendar, Link as LinkIcon } from 'lucide-react';
import type { Project, Trade, PlannerTask } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const NewTaskSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().min(1, 'Area/Plot is required.'),
  title: z.string().min(3, 'Description of work is required.'),
  tradeId: z.string().min(1, 'Trade is required.'),
  startDate: z.string().min(1, 'Start date is required.'),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day.').default(1),
  predecessorIds: z.array(z.string()).default([]),
});

type NewTaskFormValues = z.infer<typeof NewTaskSchema>;

export function NewTaskDialog({ 
  projects, 
  trades, 
  allTasks, 
  initialProjectId,
  initialAreaId
}: { 
  projects: Project[]; 
  trades: Trade[]; 
  allTasks: PlannerTask[];
  initialProjectId?: string;
  initialAreaId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewTaskFormValues>({
    resolver: zodResolver(NewTaskSchema),
    defaultValues: {
      projectId: initialProjectId || '',
      areaId: initialAreaId || '',
      title: '',
      tradeId: '',
      startDate: new Date().toISOString().split('T')[0],
      durationDays: 1,
      predecessorIds: [],
    },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedAreaId = form.watch('areaId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  // Tasks that could potentially be predecessors (same area, same project)
  const potentialPredecessors = useMemo(() => {
    if (!selectedProjectId || !selectedAreaId) return [];
    return allTasks.filter(t => t.projectId === selectedProjectId && t.areaId === selectedAreaId);
  }, [allTasks, selectedProjectId, selectedAreaId]);

  const onSubmit = (values: NewTaskFormValues) => {
    startTransition(async () => {
      try {
        const taskData = {
          ...values,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'planner-tasks'), taskData);
        toast({ title: 'Task Scheduled', description: 'Item added to property walkthrough.' });
        setOpen(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to schedule task.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (open) {
        form.reset({
            projectId: initialProjectId || '',
            areaId: initialAreaId || '',
            title: '',
            tradeId: '',
            startDate: new Date().toISOString().split('T')[0],
            durationDays: 1,
            predecessorIds: [],
        });
    }
  }, [open, initialProjectId, initialAreaId, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />Add Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Site Activity</DialogTitle>
          <DialogDescription>Define a piece of work identified during your property walkthrough.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose project" /></SelectTrigger></FormControl>
                    <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="areaId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Area / Plot</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose location" /></SelectTrigger></FormControl>
                    <SelectContent>
                        {selectedProject?.areas?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>Task Description</FormLabel><FormControl><Input placeholder="e.g. Install wall boarding" {...field} /></FormControl></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="tradeId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center gap-2"><HardHat className="h-4 w-4 text-primary" /> Trade Responsible</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose trade" /></SelectTrigger></FormControl>
                            <SelectContent>{trades.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-2">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="durationDays" render={({ field }) => (
                        <FormItem><FormLabel>Days</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            <div className="space-y-3">
                <FormLabel className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    Dependencies (Predecessors)
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
                                        {task.title} <span className="text-muted-foreground">({trades.find(t => t.id === task.tradeId)?.name})</span>
                                    </FormLabel>
                                </FormItem>
                            )}
                        />
                    )) : (
                        <p className="text-[10px] text-muted-foreground italic text-center py-8">No other tasks identified in this area yet.</p>
                    )}
                </ScrollArea>
                <FormDescription className="text-[10px]">Tasks selected here must be completed before the new task can start.</FormDescription>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Task to Walkthrough
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
