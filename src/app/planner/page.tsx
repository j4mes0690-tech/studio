
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense, useTransition } from 'react';
import type { PlannerTask, Project, Area, Trade, DistributionUser } from '@/lib/types';
import { Loader2, CalendarRange, LayoutGrid, List, ShieldCheck, Filter, Plus, Trash2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from './gantt-chart';
import { NewTaskDialog } from './new-task';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function PlannerContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGanttView, setIsGanttView] = useState(true);

  // Filters
  const projectFilter = searchParams.get('project') || 'all';
  const areaFilter = searchParams.get('area') || 'all';

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_planner');
    if (saved !== null) setIsGanttView(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isGanttView;
    setIsGanttView(newVal);
    localStorage.setItem('sitecommand_view_planner', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const tasksQuery = useMemoFirebase(() => (db ? query(collection(db, 'planner-tasks'), orderBy('startDate', 'asc')) : null), [db]);
  const { data: allTasks, isLoading: tasksLoading } = useCollection<PlannerTask>(tasksQuery);

  const tradesQuery = useMemoFirebase(() => (db ? collection(db, 'trades') : null), [db]);
  const { data: allTrades } = useCollection<Trade>(tradesQuery);

  // Security & Visibility
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(task => {
      const isAuthorised = allowedProjectIds.includes(task.projectId);
      const matchesProject = projectFilter === 'all' || task.projectId === projectFilter;
      const matchesArea = areaFilter === 'all' || task.areaId === areaFilter;
      return isAuthorised && matchesProject && matchesArea;
    });
  }, [allTasks, allowedProjectIds, projectFilter, areaFilter]);

  const currentProject = useMemo(() => allProjects?.find(p => p.id === projectFilter), [allProjects, projectFilter]);

  const handleDeleteTask = (id: string) => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'planner-tasks', id));
      toast({ title: 'Task Removed', description: 'Schedule item deleted.' });
    });
  };

  const handleToggleStatus = (task: PlannerTask) => {
    startTransition(async () => {
      const nextStatus = task.status === 'completed' ? 'pending' : task.status === 'in-progress' ? 'completed' : 'in-progress';
      await updateDoc(doc(db, 'planner-tasks', task.id), { status: nextStatus });
    });
  };

  if (tasksLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-primary" />
            Short Term Planner
          </h2>
          <p className="text-sm text-muted-foreground">Log site activities, assign trades, and visualize the construction sequence.</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleView}>
                  {isGanttView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Switch to {isGanttView ? 'List' : 'Gantt'} View</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NewTaskDialog 
            projects={allowedProjects} 
            trades={allTrades || []}
            allTasks={allTasks || []}
            initialProjectId={projectFilter !== 'all' ? projectFilter : undefined}
            initialAreaId={areaFilter !== 'all' ? areaFilter : undefined}
          />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Schedule:
          </div>
          <Select value={projectFilter} onValueChange={(v) => {
              const p = new URLSearchParams(window.location.search);
              if (v === 'all') { p.delete('project'); p.delete('area'); } else p.set('project', v);
              window.history.pushState(null, '', `?${p.toString()}`);
          }}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {projectFilter !== 'all' && (
            <Select value={areaFilter} onValueChange={(v) => {
                const p = new URLSearchParams(window.location.search);
                if (v === 'all') p.delete('area'); else p.set('area', v);
                window.history.pushState(null, '', `?${p.toString()}`);
            }}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                    <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {currentProject?.areas?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {isGanttView ? (
        <div className="overflow-x-auto pb-8">
            <GanttChart tasks={filteredTasks} trades={allTrades || []} />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => {
                const trade = allTrades?.find(t => t.id === task.tradeId);
                const project = allProjects?.find(p => p.id === task.projectId);
                const area = project?.areas?.find(a => a.id === task.areaId);
                
                return (
                    <Card key={task.id} className="hover:border-primary transition-all">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <button onClick={() => handleToggleStatus(task)} className="mt-1">
                                    {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : task.status === 'in-progress' ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                </button>
                                <div className="space-y-1 min-w-0">
                                    <p className={cn("font-bold truncate", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tight">{trade?.name || 'Unknown Trade'}</Badge>
                                        <span className="text-[10px] text-muted-foreground">{project?.name} &rsaquo; {area?.name || 'General Site'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Start Date</p>
                                    <p className="text-xs font-bold">{new Date(task.startDate).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duration</p>
                                    <p className="text-xs font-bold">{task.durationDays} Days</p>
                                </div>
                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteTask(task.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )
            })
          ) : (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
              <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">No tasks scheduled</p>
              <p className="text-sm">Click "Add Task" to start building your short term plan.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlannerPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Short Term Planner" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <PlannerContent />
      </Suspense>
    </div>
  );
}
