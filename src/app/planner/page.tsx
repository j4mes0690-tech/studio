
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, arrayUnion, writeBatch, where, getDocs, getDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense, useTransition } from 'react';
import type { PlannerTask, Project, Planner, DistributionUser, Photo, SubContractor } from '@/lib/types';
import { 
    Loader2, 
    CalendarRange, 
    LayoutGrid, 
    List, 
    ShieldCheck, 
    Maximize2,
    Building2,
    ChevronRight,
    ArrowLeft,
    PlusCircle,
    Layout,
    Save,
    Circle,
    CheckCircle2,
    FileDown,
    Send,
    Archive,
    Trash2,
    ArchiveRestore,
    Eye,
    EyeOff
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { generatePlannerPDF } from '@/lib/pdf-utils';
import { DistributePlannerButton } from './distribute-planner-button';

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
  const [isExporting, setIsExporting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  const [isAddPlannerOpen, setIsAddPlannerOpen] = useState(false);
  const [newPlannerName, setNewPlannerName] = useState('');

  const projectFilter = searchParams.get('project');
  const plannerFilter = searchParams.get('planner');

  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_planner');
    if (saved !== null) setIsGanttView(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isGanttView;
    setIsGanttView(newVal);
    localStorage.setItem('sitecommand_view_planner', String(newVal));
  };

  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const tasksQuery = useMemoFirebase(() => (db ? query(collection(db, 'planner-tasks'), orderBy('startDate', 'asc')) : null), [db]);
  const { data: allTasks, isLoading: tasksLoading } = useCollection<PlannerTask>(tasksQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

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

  const plannerStats = useMemo(() => {
    const stats = new Map<string, { total: number, completed: number }>();
    if (!allTasks || !projectFilter) return stats;
    
    allTasks.filter(t => t.projectId === projectFilter).forEach(task => {
        const pId = task.plannerId || task.areaId;
        if (!pId) return;
        const current = stats.get(pId) || { total: 0, completed: 0 };
        stats.set(pId, {
            total: current.total + 1,
            completed: current.completed + (task.status === 'completed' ? 1 : 0)
        });
    });
    return stats;
  }, [allTasks, projectFilter]);

  const currentProject = useMemo(() => allowedProjects.find(p => p.id === projectFilter), [allowedProjects, projectFilter]);
  const currentPlanner = useMemo(() => {
    const planners = [...(currentProject?.planners || []), ...(currentProject?.areas || [])];
    return planners.find(p => p.id === plannerFilter);
  }, [currentProject, plannerFilter]);

  const filteredTasks = useMemo(() => {
    if (!allTasks || !projectFilter || !plannerFilter) return [];
    return allTasks
      .filter(task => 
        task.projectId === projectFilter && 
        (task.plannerId === plannerFilter || task.areaId === plannerFilter)
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [allTasks, projectFilter, plannerFilter]);

  const editingTask = useMemo(() => {
    if (!editingTaskId || !allTasks) return null;
    return allTasks.find(t => t.id === editingTaskId);
  }, [editingTaskId, allTasks]);

  const selectProject = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('project', id);
    params.delete('planner');
    router.push(`/planner?${params.toString()}`);
  };

  const selectPlanner = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('planner', id);
    router.push(`/planner?${params.toString()}`);
  };

  const clearProject = () => router.push('/planner');
  const clearPlanner = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('planner');
    router.push(`/planner?${params.toString()}`);
  };

  const handleAddPlanner = () => {
    if (!newPlannerName.trim() || !currentProject) return;
    startTransition(async () => {
        const newPlanner: Planner = {
            id: `planner-${currentProject.id}-${Date.now()}`,
            name: newPlannerName.trim(),
            archived: false
        };
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, {
            planners: arrayUnion(newPlanner)
        });
        toast({ title: 'New Planner Added', description: `Planner "${newPlanner.name}" is ready for scheduling.` });
        setNewPlannerName('');
        setIsAddPlannerOpen(false);
    });
  };

  const handleToggleArchivePlanner = (plannerId: string, isArchived: boolean) => {
    if (!currentProject) return;
    startTransition(async () => {
        const updatedPlanners = (currentProject.planners || []).map(p => 
            p.id === plannerId ? { ...p, archived: !isArchived } : p
        );
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, { planners: updatedPlanners });
        toast({ 
            title: isArchived ? 'Planner Restored' : 'Planner Archived', 
            description: `Schedule has been ${isArchived ? 'restored to active view' : 'moved to archives'}.` 
        });
    });
  };

  const handleDeletePlanner = (plannerId: string) => {
    if (!projectFilter || !db) return;
    
    startTransition(async () => {
        try {
            const projRef = doc(db, 'projects', projectFilter);
            const projSnap = await getDoc(projRef);
            
            if (!projSnap.exists()) {
                toast({ title: 'Error', description: 'Project not found.', variant: 'destructive' });
                return;
            }

            const projData = projSnap.data();
            const updates: any = {};
            
            // Clean up both possible array keys for broad compatibility
            if (projData.planners) {
                updates.planners = projData.planners.filter((p: any) => p.id !== plannerId);
            }
            if (projData.areas) {
                updates.areas = projData.areas.filter((a: any) => a.id !== plannerId);
            }

            // 1. Update the Project Document
            await updateDoc(projRef, updates);

            // 2. Cleanup all associated tasks in a batch
            const tasksQuery = query(collection(db, 'planner-tasks'), where('plannerId', '==', plannerId));
            const tasksSnap = await getDocs(tasksQuery);
            
            const batch = writeBatch(db);
            tasksSnap.forEach((tDoc) => {
                batch.delete(tDoc.ref);
            });
            
            // Also cleanup legacy 'areaId' scoped tasks
            const legacyTasksQuery = query(collection(db, 'planner-tasks'), where('areaId', '==', plannerId));
            const legacyTasksSnap = await getDocs(legacyTasksQuery);
            legacyTasksSnap.forEach((tDoc) => {
                batch.delete(tDoc.ref);
            });

            await batch.commit();

            // 3. Navigate back if the user was currently viewing the deleted planner
            if (plannerFilter === plannerId) {
                clearPlanner();
            }
            
            toast({ title: 'Planner Deleted', description: 'Schedule and all associated tasks have been permanently removed.' });
        } catch (err) {
            console.error("Delete planner error:", err);
            toast({ title: 'Error', description: 'Failed to delete planner.', variant: 'destructive' });
        }
    });
  };

  const handleDownloadPDF = async () => {
    if (!currentProject || !currentPlanner) return;
    setIsExporting(true);
    try {
      const pdf = await generatePlannerPDF(filteredTasks, currentProject, currentPlanner, allSubContractors || []);
      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`Schedule-${currentProject.name.replace(/\s+/g, '-')}-${currentPlanner.name.replace(/\s+/g, '-')}-${timestamp}.pdf`);
      toast({ title: "PDF Ready", description: "Your schedule has been exported." });
    } catch (err) {
      console.error(err);
      toast({ title: "Export Error", description: "Failed to generate schedule PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (tasksLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!projectFilter) {
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Work Planner</h2>
                <p className="text-sm text-muted-foreground">Select a project to view its active schedules.</p>
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
                                <CardDescription>{(project.planners?.length || 0) + (project.areas?.length || 0)} Standalone Planners</CardDescription>
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

  if (projectFilter && !plannerFilter) {
    const planners = [...(currentProject?.planners || []), ...(currentProject?.areas || [])];
    const visiblePlanners = planners.filter(p => !!p.archived === showArchived);

    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={clearProject} className="mb-2 -ml-2 text-muted-foreground h-8 gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> All Projects
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {currentProject?.name} Schedules
                    </h2>
                    <p className="text-sm text-muted-foreground">Select a specific planner to manage its critical path.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    onClick={() => setShowArchived(!showArchived)}
                                    className={cn("h-10 w-10", showArchived && "bg-muted")}
                                >
                                    {showArchived ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{showArchived ? 'View Active Planners' : 'View Archived Planners'}</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {(profile.permissions?.canManageProjects || profile.permissions?.hasFullVisibility) && (
                        <Dialog open={isAddPlannerOpen} onOpenChange={setIsAddPlannerOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Add New Planner</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add Project Planner</DialogTitle>
                                    <DialogDescription>Create a new distinct schedule for this project.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-muted-foreground">Planner Title</label>
                                        <Input placeholder="e.g. Fit-out Schedule, Shell & Core" value={newPlannerName} onChange={e => setNewPlannerName(e.target.value)} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsAddPlannerOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddPlanner} disabled={isPending || !newPlannerName.trim()}>
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                        Create Planner
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePlanners.length > 0 ? visiblePlanners.map(planner => {
                    const stats = plannerStats.get(planner.id) || { total: 0, completed: 0 };
                    const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                    return (
                        <Card 
                            key={planner.id} 
                            className={cn(
                                "cursor-pointer hover:border-primary/50 transition-all group hover:shadow-md flex flex-col",
                                planner.archived && "opacity-75 grayscale"
                            )} 
                            onClick={() => selectPlanner(planner.id)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 mb-2 uppercase text-[9px] font-black tracking-widest">
                                        {planner.archived ? 'Archived Planner' : 'Planner'}
                                    </Badge>
                                    <div className="flex items-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-7 w-7 text-muted-foreground hover:text-primary transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleToggleArchivePlanner(planner.id, !!planner.archived); }}
                                                    >
                                                        {planner.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{planner.archived ? 'Restore Planner' : 'Archive Planner'}</p></TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <AlertDialog>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Delete Planner</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <AlertDialogContent onClick={e => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Entire Planner?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the planner "<strong>{planner.name}</strong>" and ALL associated tasks. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive" onClick={() => handleDeletePlanner(planner.id)}>Delete Everything</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                                <CardTitle className="text-xl group-hover:text-primary transition-colors">{planner.name}</CardTitle>
                                <CardDescription>{stats.total} Active Activities</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 flex-1">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                                        <span>Status</span>
                                        <span>{Math.round(progress)}% Complete</span>
                                    </div>
                                    <Progress value={progress} className="h-1.5" indicatorClassName={progress === 100 ? "bg-green-500" : ""} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                }) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
                        <Layout className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-muted-foreground">
                            {showArchived ? 'No archived planners.' : 'No active planners defined for this project.'}
                        </p>
                        {!showArchived && <p className="text-sm text-muted-foreground mt-1">Use "Add New Planner" to initialize a schedule.</p>}
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <>
        <div className="flex flex-col w-full gap-6 p-4 md:p-8">
            <div className="flex flex-col gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Button variant="ghost" size="sm" onClick={clearPlanner} className="text-muted-foreground h-8 p-0 hover:bg-transparent hover:text-primary">
                            {currentProject?.name}
                        </Button>
                        <span className="text-muted-foreground text-xs">&rsaquo;</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px] font-black h-6">{currentPlanner?.name}</Badge>
                        {currentPlanner?.archived && <Badge variant="outline" className="text-[10px] uppercase font-bold h-6 border-amber-200 text-amber-700 bg-amber-50">Archived</Badge>}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                            <Layout className="h-7 w-7 text-primary" />
                            Construction Schedule
                        </h2>
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button variant="outline" size="icon" onClick={handleDownloadPDF} disabled={isExporting} className="h-10 w-10">
                                        {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
                                      </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Export Schedule PDF</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <DistributePlannerButton 
                              tasks={filteredTasks}
                              project={currentProject}
                              planner={currentPlanner}
                              subContractors={allSubContractors || []}
                            />

                            <TooltipProvider>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={toggleView} className="h-10 w-10">
                                    {isGanttView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Switch to {isGanttView ? 'List' : 'Gantt'} View</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <NewTaskDialog 
                                projects={allowedProjects} 
                                subContractors={allSubContractors || []}
                                allTasks={allTasks || []}
                                initialProjectId={projectFilter}
                                initialPlannerId={plannerFilter!}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isGanttView ? (
                <div className="overflow-x-auto pb-8">
                    <GanttChart 
                      tasks={filteredTasks} 
                      subContractors={allSubContractors || []} 
                      projects={allowedProjects} 
                      onTaskClick={(task) => setEditingTaskId(task.id)}
                    />
                </div>
            ) : (
                <div className="grid gap-4">
                {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => {
                        const sub = allSubContractors?.find(s => s.id === task.subcontractorId);
                        const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned Partner');
                        
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
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-black bg-primary/5 text-primary border-primary/10 tracking-tight">{tradeName}</Badge>
                                                </div>
                                            </div>
                                            
                                            {task.photos && task.photos.length > 0 && (
                                                <div className="flex gap-2 flex-wrap pt-1">
                                                    {task.photos.map((p, idx) => (
                                                        <div key={idx} className="relative w-12 h-12 rounded-md border bg-muted overflow-hidden group cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                                                            <Image src={p.url} alt="Task Context" fill className="object-cover" />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
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
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Planned Days</p>
                                            <p className="text-xs font-bold">{task.durationDays}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
                        <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-semibold">No activities scheduled for this planner</p>
                        <p className="text-sm">Click "Add Task" to begin building your project schedule.</p>
                    </div>
                )}
                </div>
            )}
        </div>

        {editingTask && (
            <EditTaskDialog 
                task={editingTask} 
                projects={allowedProjects} 
                subContractors={allSubContractors || []} 
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
      <Header title="Project Schedules" />
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
