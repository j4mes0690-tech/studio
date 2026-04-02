
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, arrayUnion, writeBatch, where, getDocs, getDoc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense, useTransition } from 'react';
import type { PlannerTask, Project, Planner, DistributionUser, Photo, SubContractor, PlannerSection } from '@/lib/types';
import Image from 'next/image';
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
    Archive,
    Trash2,
    ArchiveRestore,
    Eye,
    EyeOff,
    Clock,
    Layers,
    Plus,
    X,
    Settings2
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
import { cn, optimiseGlobalSchedule } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ImageLightbox } from '@/components/image-lightbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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

  const [isManageSectionsOpen, setIsManageSectionsOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

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
            archived: false,
            includeSaturday: false,
            includeSunday: false,
            sections: []
        };
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, {
            planners: arrayUnion(newPlanner)
        });
        toast({ title: 'New Planner Added', description: `Planner "${newPlanner.name}" is ready.` });
        setNewPlannerName('');
        setIsAddPlannerOpen(false);
    });
  };

  const handleAddSection = () => {
    if (!newSectionName.trim() || !currentProject || !currentPlanner) return;
    startTransition(async () => {
        const newSection: PlannerSection = {
            id: `sec-${Date.now()}`,
            name: newSectionName.trim()
        };
        const updatedPlanners = (currentProject.planners || []).map(p => 
            p.id === currentPlanner.id 
                ? { ...p, sections: [...(p.sections || []), newSection] } 
                : p
        );
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, { planners: updatedPlanners });
        toast({ title: 'Section Added', description: `"${newSection.name}" created.` });
        setNewSectionName('');
    });
  };

  const handleRemoveSection = (sectionId: string) => {
    if (!currentProject || !currentPlanner) return;
    startTransition(async () => {
        const updatedPlanners = (currentProject.planners || []).map(p => 
            p.id === currentPlanner.id 
                ? { ...p, sections: (p.sections || []).filter(s => s.id !== sectionId) } 
                : p
        );
        const projRef = doc(db, 'projects', currentProject.id);
        await updateDoc(projRef, { planners: updatedPlanners });
        
        // Also unassign tasks from this section
        const batch = writeBatch(db);
        const sectionTasks = allTasks.filter(t => t.sectionId === sectionId);
        sectionTasks.forEach(t => {
            batch.update(doc(db, 'planner-tasks', t.id), { sectionId: null });
        });
        await batch.commit();
        
        toast({ title: 'Section Removed', description: 'Associated tasks have been moved to General.' });
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
        <main className="flex-1 space-y-6 p-4 md:p-8">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Work Planner</h2>
                <p className="text-sm text-muted-foreground">Select a project to view its active schedules.</p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-20">
                {allowedProjects.length > 0 ? allowedProjects.map(project => {
                    const stats = allTasks ? allTasks.filter(t => t.projectId === project.id).reduce((acc, t) => ({
                        total: acc.total + 1,
                        completed: acc.completed + (t.status === 'completed' ? 1 : 0)
                    }), { total: 0, completed: 0 }) : { total: 0, completed: 0 };
                    
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
        </main>
    );
  }

  if (projectFilter && !plannerFilter) {
    const planners = [...(currentProject?.planners || []), ...(currentProject?.areas || [])];
    const visiblePlanners = planners.filter(p => !!p.archived === showArchived);

    return (
        <main className="flex-1 space-y-6 p-4 md:p-8">
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
                            <TooltipContent><p>{showArchived ? 'View Active' : 'View Archived'}</p></TooltipContent>
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
                                        <Input placeholder="e.g. Fit-out Schedule" value={newPlannerName} onChange={e => setNewPlannerName(e.target.value)} />
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

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-20">
                {visiblePlanners.map(planner => {
                    const stats = allTasks ? allTasks.filter(t => t.plannerId === planner.id || t.areaId === planner.id).reduce((acc, t) => ({
                        total: acc.total + 1,
                        completed: acc.completed + (t.status === 'completed' ? 1 : 0)
                    }), { total: 0, completed: 0 }) : { total: 0, completed: 0 };
                    
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
                                        {planner.archived ? 'Archived' : 'Planner'}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
                                    <Progress value={progress} className="h-1.5" />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col w-full gap-6 p-4 md:p-8 overflow-hidden">
        <div className="flex flex-col gap-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                    <Button variant="ghost" size="sm" onClick={clearPlanner} className="text-muted-foreground h-8 p-0 hover:bg-transparent hover:text-primary">
                        {currentProject?.name}
                    </Button>
                    <span className="text-muted-foreground text-xs">&rsaquo;</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary uppercase text-[10px] font-black h-6">{currentPlanner?.name}</Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Layout className="h-7 w-7 text-primary" />
                        Construction Schedule
                    </h2>
                    <div className="flex items-center gap-2">
                        <Dialog open={isManageSectionsOpen} onOpenChange={setIsManageSectionsOpen}>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-10 w-10 text-primary border-primary/20">
                                                <Layers className="h-5 w-5" />
                                            </Button>
                                        </DialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Manage Schedule Sections</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Planner Sections</DialogTitle>
                                    <DialogDescription>Define groupings for your tasks (e.g. By Floor or Phase).</DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-6">
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Section Name..." 
                                            value={newSectionName} 
                                            onChange={e => setNewSectionName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                                        />
                                        <Button size="icon" onClick={handleAddSection} disabled={isPending || !newSectionName.trim()}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-64 border rounded-md p-2 bg-muted/5">
                                        {currentPlanner?.sections?.length ? (
                                            <div className="space-y-2">
                                                {currentPlanner.sections.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between p-2 bg-background border rounded group shadow-sm">
                                                        <span className="text-sm font-bold text-primary">{s.name}</span>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleRemoveSection(s.id)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-10 text-center text-xs text-muted-foreground italic">No sections defined. Tasks will be grouped in "General".</div>
                                        )}
                                    </ScrollArea>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" className="w-full" onClick={() => setIsManageSectionsOpen(false)}>Close</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

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
                            <TooltipContent><p>Switch View</p></TooltipContent>
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

        <div className="flex-1 w-full overflow-hidden">
            {isGanttView ? (
                <GanttChart 
                    tasks={filteredTasks} 
                    subContractors={allSubContractors || []} 
                    projects={allowedProjects}
                    planner={currentPlanner}
                    onTaskClick={(task) => setEditingTaskId(task.id)}
                />
            ) : (
                <ScrollArea className="h-full pb-20">
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
                                                        {task.sectionId && (
                                                            <Badge variant="outline" className="text-[9px] h-4 gap-1 px-1.5 font-bold uppercase text-muted-foreground">
                                                                <Layers className="h-2 w-2" />
                                                                {currentPlanner?.sections?.find(s => s.id === task.sectionId)?.name}
                                                            </Badge>
                                                        )}
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
                            <p className="text-sm">Click "Log Task" to begin building your project schedule.</p>
                        </div>
                    )}
                    </div>
                </ScrollArea>
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
    </main>
  );
}

export default function PlannerPage() {
  return (
    <div className="flex flex-col w-full min-h-svh bg-background">
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
