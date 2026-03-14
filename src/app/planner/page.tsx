
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense, useTransition } from 'react';
import type { PlannerTask, Project, Area, Trade, DistributionUser, Photo } from '@/lib/types';
import { 
    Loader2, 
    CalendarRange, 
    LayoutGrid, 
    List, 
    ShieldCheck, 
    Filter, 
    Plus, 
    Trash2, 
    CheckCircle2, 
    Circle, 
    AlertCircle, 
    Camera, 
    Maximize2,
    Building2,
    MapPin,
    ChevronRight,
    ArrowLeft,
    PlusCircle,
    Layout
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from './gantt-chart';
import { NewTaskDialog } from './new-task';
import { EditTaskDialog } from './edit-task';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/image-lightbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import Image from 'next/image';

function PlannerContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isGanttView, setIsGanttView] = useState(true);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  // New Area Form State
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  // Filters from URL
  const projectFilter = searchParams.get('project');
  const areaFilter = searchParams.get('area');

  // Load persistence for view mode
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

  // Task Statistics for Directory
  const projectStats = useMemo(() => {
    const stats = new Map<string, { total: number, completed: number }>();
    if (!allTasks) return stats;
    
    allTasks.forEach(task => {
        const pId = task.projectId;
        const current = stats.get(pId) || { total: 0, completed: 0 };
        stats.set(pId, {
            total: current.total + 1,
            completed: current.completed + (task.status === 'completed' ? 1 : 0)
        });
    });
    return stats;
  }, [allTasks]);

  const areaStats = useMemo(() => {
    const stats = new Map<string, { total: number, completed: number }>();
    if (!allTasks || !projectFilter) return stats;
    
    allTasks.filter(t => t.projectId === projectFilter).forEach(task => {
        const aId = task.areaId;
        const current = stats.get(aId) || { total: 0, completed: 0 };
        stats.set(aId, {
            total: current.total + 1,
            completed: current.completed + (task.status === 'completed' ? 1 : 0)
        });
    });
    return stats;
  }, [allTasks, projectFilter]);

  // Current Selections
  const currentProject = useMemo(() => allowedProjects.find(p => p.id === projectFilter), [allowedProjects, projectFilter]);
  const currentArea = useMemo(() => currentProject?.areas?.find(a => a.id === areaFilter), [currentProject, areaFilter]);

  // Filtered Tasks for Active Planner
  const filteredTasks = useMemo(() => {
    if (!allTasks || !projectFilter || !areaFilter) return [];
    return allTasks.filter(task => 
        task.projectId === projectFilter && 
        task.areaId === areaFilter
    );
  }, [allTasks, projectFilter, areaFilter]);

  const editingTask = useMemo(() => {
    if (!editingTaskId || !allTasks) return null;
    return allTasks.find(t => t.id === editingTaskId);
  }, [editingTaskId, allTasks]);

  // Navigation Handlers
  const selectProject = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('project', id);
    params.delete('area');
    router.push(`/planner?${params.toString()}`);
  };

  const selectArea = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('area', id);
    router.push(`/planner?${params.toString()}`);
  };

  const clearProject = () => router.push('/planner');
  const clearArea = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('area');
    router.push(`/planner?${params.toString()}`);
  };

  const handleAddArea = () => {
    if (!newAreaName.trim() || !currentProject) return;
    startTransition(async () => {
        const newArea: Area = {
            id: `area-${currentProject.id}-${Date.now()}`,
            name: newAreaName.trim()
        };
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, {
            areas: arrayUnion(newArea)
        });
        toast({ title: 'New Planner Added', description: `Block "${newArea.name}" is ready for scheduling.` });
        setNewAreaName('');
        setIsAddAreaOpen(false);
    });
  };

  if (tasksLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- VIEW 1: Project Selection Directory ---
  if (!projectFilter) {
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Work Planner</h2>
                <p className="text-sm text-muted-foreground">Select a project to view its block schedules.</p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allowedProjects.length > 0 ? allowedProjects.map(project => {
                    const stats = projectStats.get(project.id) || { total: 0, completed: 0 };
                    const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                    return (
                        <Card key={project.id} className="cursor-pointer hover:border-primary/50 transition-all group hover:shadow-md" onClick={() => selectProject(project.id)}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 mb-2 uppercase text-[9px] font-black tracking-widest">Project</Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-xl group-hover:text-primary transition-colors">{project.name}</CardTitle>
                                <CardDescription>{project.areas?.length || 0} Planning Blocks</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                        <span>Overall Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5" />
                                </div>
                                <p className="text-xs text-muted-foreground">{stats.total} total activities logged.</p>
                            </CardContent>
                        </Card>
                    );
                }) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
                        <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-muted-foreground">No projects assigned.</p>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- VIEW 2: Area/Block Selection Directory ---
  if (projectFilter && !areaFilter) {
    const areas = currentProject?.areas || [];
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={clearProject} className="mb-2 -ml-2 text-muted-foreground h-8 gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> All Projects
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {currentProject?.name} Planners
                    </h2>
                    <p className="text-sm text-muted-foreground">Select a specific block or location to manage its critical path.</p>
                </div>
                
                {(profile.permissions?.canManageProjects || profile.permissions?.hasFullVisibility) && (
                    <Dialog open={isAddAreaOpen} onOpenChange={setIsAddAreaOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Add New Block</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Planning Workspace</DialogTitle>
                                <DialogDescription>Create a new block or level to host its own schedule.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Block Name</label>
                                    <Input placeholder="e.g. Block A, Level 1, Phase 2" value={newAreaName} onChange={e => setNewAreaName(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsAddAreaOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddArea} disabled={isPending || !newAreaName.trim()}>
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                    Create Planner
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {areas.length > 0 ? areas.map(area => {
                    const stats = areaStats.get(area.id) || { total: 0, completed: 0 };
                    const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                    return (
                        <Card key={area.id} className="cursor-pointer hover:border-primary/50 transition-all group hover:shadow-md" onClick={() => selectArea(area.id)}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 mb-2 uppercase text-[9px] font-black tracking-widest">Block Schedule</Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-xl group-hover:text-primary transition-colors">{area.name}</CardTitle>
                                <CardDescription>{stats.total} Active Items</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                        <span>Schedule Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5" indicatorClassName={progress === 100 ? "bg-green-500" : ""} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                }) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
                        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-muted-foreground">No blocks defined for this project.</p>
                        <p className="text-sm text-muted-foreground mt-1">Use "Add New Block" to initialize a schedule.</p>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- VIEW 3: Active Schedule View ---
  return (
    <>
        <div className="flex flex-col w-full gap-6 p-4 md:p-8">
            <div className="flex flex-col gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="sm" onClick={clearArea} className="text-muted-foreground h-8 p-0 hover:bg-transparent hover:text-primary">
                            {currentProject?.name}
                        </Button>
                        <span className="text-muted-foreground text-xs">&rsaquo;</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px] font-black h-6">{currentArea?.name}</Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Layout className="h-7 w-7 text-primary" />
                            Work Planner
                        </h2>
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
                                initialProjectId={projectFilter}
                                initialAreaId={areaFilter!}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isGanttView ? (
                <div className="overflow-x-auto pb-8">
                    <GanttChart 
                      tasks={filteredTasks} 
                      trades={allTrades || []} 
                      projects={allowedProjects} 
                      onTaskClick={(task) => setEditingTaskId(task.id)}
                    />
                </div>
            ) : (
                <div className="grid gap-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => {
                        const trade = allTrades?.find(t => t.id === task.tradeId);
                        
                        return (
                            <Card key={task.id} className="hover:border-primary transition-all overflow-hidden cursor-pointer" onClick={() => setEditingTaskId(task.id)}>
                                <CardContent className="p-0 flex flex-col sm:flex-row items-stretch">
                                    <div className="p-4 flex flex-1 items-start gap-3 min-w-0">
                                        <div className="mt-1">
                                            {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : task.status === 'in-progress' ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                        </div>
                                        <div className="space-y-2 min-w-0 flex-1">
                                            <div className="space-y-1">
                                                <p className={cn("font-bold truncate text-base", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-black bg-primary/5 text-primary border-primary/10 tracking-tight">{trade?.name || 'Unknown Trade'}</Badge>
                                                </div>
                                            </div>
                                            
                                            {task.photos && task.photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap pt-1">
                                                    {task.photos.map((p, idx) => (
                                                        <div key={idx} className="relative w-12 h-12 rounded-md border bg-muted overflow-hidden group cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                                                            <Image src={p.url} alt="Task Context" fill className="object-cover" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Maximize2 className="h-3 w-3 text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-muted/10 border-t sm:border-t-0 sm:border-l flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Forecast Start</p>
                                            <p className="text-xs font-bold">{new Date(task.startDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Duration</p>
                                            <p className="text-xs font-bold">{task.durationDays} Days</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
                        <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-semibold">No tasks scheduled for this block</p>
                        <p className="text-sm">Click "Add Task" to begin your site walkthrough.</p>
                    </div>
                )}
                </div>
            )}
        </div>

        {editingTask && (
            <EditTaskDialog 
                task={editingTask} 
                projects={allowedProjects} 
                trades={allTrades || []} 
                allTasks={allTasks || []} 
                open={!!editingTaskId} 
                onOpenChange={(open) => !open && setEditingTaskId(null)} 
            />
        )}

        <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}

export default function PlannerPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Header title="Schedule Workspace" />
      <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <PlannerContent />
      </Suspense>
    </div>
  );
}
