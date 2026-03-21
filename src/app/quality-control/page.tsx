'use client';

import { Header } from '@/components/layout/header';
import { ChecklistCard } from './checklist-card';
import { AddChecklistToProject } from './add-checklist-to-project';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { QualityChecklist, Project, SubContractor, DistributionUser, Area } from '@/lib/types';
import { Loader2, ChevronRight, LayoutGrid, ClipboardCheck, Building2, MapPin, ArrowLeft, CheckCircle2, List, FileCheck, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function QualityControlContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();

  const activeProjectId = searchParams.get('project');
  const activeAreaId = searchParams.get('area');
  const activeChecklistId = searchParams.get('checklist');

  const [isCompact, setIsCompact] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_quality_control');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_quality_control', String(newVal));
  };

  // Profile check
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Real-time data from Firestore
  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const checklistsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'quality-checklists'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: allChecklists, isLoading: checklistsLoading } = useCollection<QualityChecklist>(checklistsQuery);

  // Visibility logic
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const checklistInstances = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => !c.isTemplate);
  }, [allChecklists]);

  const checklistTemplates = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => !!c.isTemplate);
  }, [allChecklists]);

  // Derived Data: Project Progress
  const projectProgress = useMemo(() => {
    if (!checklistInstances) return new Map();
    const map = new Map();
    checklistInstances.forEach(c => {
        if (!c.projectId) return;
        const current = map.get(c.projectId) || { total: 0, closed: 0 };
        const totalItems = c.items?.length || 0;
        const closedItems = c.items?.filter(i => i.status !== 'pending' && i.status !== 'no').length || 0;
        map.set(c.projectId, { total: current.total + totalItems, closed: current.closed + closedItems });
    });
    return map;
  }, [checklistInstances]);

  // Derived Data: Area Progress
  const areaProgress = useMemo(() => {
    if (!checklistInstances || !activeProjectId) return new Map();
    const map = new Map();
    checklistInstances.forEach(c => {
        if (c.projectId !== activeProjectId || !c.areaId) return;
        const current = map.get(c.areaId) || { total: 0, closed: 0, count: 0 };
        const totalItems = c.items?.length || 0;
        const closedItems = c.items?.filter(i => i.status !== 'pending' && i.status !== 'no').length || 0;
        map.set(c.areaId, { 
            total: current.total + totalItems, 
            closed: current.closed + closedItems,
            count: current.count + 1
        });
    });
    return map;
  }, [checklistInstances, activeProjectId]);

  const filteredChecklists = useMemo(() => {
    if (!checklistInstances) return [];
    return checklistInstances.filter(c => 
        c.projectId === activeProjectId &&
        c.areaId === activeAreaId
    );
  }, [checklistInstances, activeProjectId, activeAreaId]);

  const focusedChecklist = useMemo(() => {
    if (!activeChecklistId || !allChecklists) return null;
    return allChecklists.find(c => c.id === activeChecklistId);
  }, [activeChecklistId, allChecklists]);

  // Navigation Helpers
  const navigateToProject = (id: string) => router.push(`/quality-control?project=${id}`);
  const navigateToArea = (id: string) => router.push(`/quality-control?project=${activeProjectId}&area=${id}`);
  const navigateToChecklist = (id: string) => router.push(`/quality-control?project=${activeProjectId}&area=${activeAreaId}&checklist=${id}`);
  
  const clearSelection = () => router.push('/quality-control');
  const clearArea = () => router.push(`/quality-control?project=${activeProjectId}`);
  const clearChecklist = () => router.push(`/quality-control?project=${activeProjectId}&area=${activeAreaId}`);

  const isLoading = projectsLoading || subsLoading || checklistsLoading || profileLoading;

  if (isLoading && !allChecklists) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // LEVEL 4: Focused Checklist Detail View
  if (activeProjectId && activeAreaId && focusedChecklist) {
    const project = allowedProjects.find(p => p.id === activeProjectId);
    const area = project?.areas?.find(a => a.id === activeAreaId);
    
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center">
                <Button variant="ghost" size="sm" onClick={clearChecklist} className="text-muted-foreground gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> Back to {area?.name || 'Area'}
                </Button>
            </div>
            
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <FileCheck className="h-6 w-6 text-primary" />
                    {focusedChecklist.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span>{project?.name}</span>
                    <span>&gt;</span>
                    <span>{area?.name}</span>
                </div>
            </div>

            <ChecklistCard 
                checklist={focusedChecklist} 
                projects={allowedProjects} 
                subContractors={subContractors || []} 
                defaultExpanded={true}
            />
        </div>
    );
  }

  // LEVEL 3: Individual Checklists in an Area
  if (activeProjectId && activeAreaId) {
    const project = allowedProjects.find(p => p.id === activeProjectId);
    const area = project?.areas?.find(a => a.id === activeAreaId);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={clearArea} className="mb-2 -ml-2 text-muted-foreground h-8 gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back to {project?.name || 'Project'}
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" />
                        {area?.name || 'Plot View'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={toggleView}>
                                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Switch to {isCompact ? 'Grid' : 'Compact'} View</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {isCompact ? (
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Trade</TableHead>
                                <TableHead>Checklist Title</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredChecklists.length > 0 ? filteredChecklists.map((checklist) => {
                                const completed = checklist.items.filter(i => i.status !== 'pending').length;
                                const total = checklist.items.length;
                                const progress = total > 0 ? (completed / total) * 100 : 0;
                                const hasFail = checklist.items.some(i => i.status === 'no');
                                return (
                                    <TableRow 
                                        key={checklist.id} 
                                        className="group cursor-pointer"
                                        onClick={() => navigateToChecklist(checklist.id)}
                                    >
                                        <TableCell><Badge variant={hasFail ? "destructive" : "outline"}>{checklist.trade}</Badge></TableCell>
                                        <TableCell className="font-medium group-hover:text-primary transition-colors">{checklist.title}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 min-w-[120px]">
                                                <Progress value={progress} className="h-1.5" indicatorClassName={hasFail ? "bg-destructive" : ""} />
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{completed}/{total}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {hasFail ? (
                                                <Badge variant="destructive" className="text-[10px]">FAILED</Badge>
                                            ) : progress === 100 ? (
                                                <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">COMPLETE</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px]">IN PROGRESS</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No checklists assigned.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="grid gap-4 md:gap-6">
                    {filteredChecklists.length > 0 ? (
                        filteredChecklists.map((checklist) => (
                            <div 
                                key={checklist.id} 
                                className="cursor-pointer transition-transform active:scale-[0.99]"
                                onClick={() => navigateToChecklist(checklist.id)}
                            >
                                <ChecklistCard
                                    checklist={checklist}
                                    projects={allowedProjects}
                                    subContractors={subContractors || []}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <p className="text-lg font-semibold">No checklists assigned to this plot</p>
                            <p className="text-sm">Assign a trade checklist to begin quality tracking.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  }

  // LEVEL 2: Areas within a Project
  if (activeProjectId) {
    const project = allowedProjects.find(p => p.id === activeProjectId);
    const areas = project?.areas || [];
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={clearSelection} className="mb-2 -ml-2 text-muted-foreground h-8 gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back to All Projects
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {project?.name || 'Project Overview'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={toggleView}>
                                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Switch to {isCompact ? 'Grid' : 'Compact'} View</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {isCompact ? (
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Area / Plot Name</TableHead>
                                <TableHead>Checklists</TableHead>
                                <TableHead>Verified Points</TableHead>
                                <TableHead>Global Progress</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {areas.length > 0 ? areas.map(area => {
                                const stats = areaProgress.get(area.id) || { total: 0, closed: 0, count: 0 };
                                const progress = stats.total > 0 ? (stats.closed / stats.total) * 100 : 0;
                                return (
                                    <TableRow key={area.id} className="cursor-pointer group" onClick={() => navigateToArea(area.id)}>
                                        <TableCell className="font-semibold group-hover:text-primary transition-colors">{area.name}</TableCell>
                                        <TableCell><Badge variant="secondary">{stats.count} Trade Checks</Badge></TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{stats.closed} / {stats.total} points</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 min-w-[120px]">
                                                <Progress value={progress} className="h-1.5" />
                                                <span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary" />
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No areas defined.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {areas.length > 0 ? areas.map(area => {
                        const stats = areaProgress.get(area.id) || { total: 0, closed: 0, count: 0 };
                        const progress = stats.total > 0 ? (stats.closed / stats.total) * 100 : 0;
                        return (
                            <Card key={area.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group" onClick={() => navigateToArea(area.id)}>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 mb-2">PLOT / AREA</Badge>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{area.name}</CardTitle>
                                    <CardDescription>{stats.count} Checklists Assigned</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            <span>Completion</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} className="h-2" />
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <CheckCircle2 className={cn("h-3 w-3", stats.total > 0 && stats.total === stats.closed ? "text-green-500" : "text-muted-foreground")} />
                                        <span>{stats.closed} / {stats.total} points verified</span>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    }) : (
                        <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <p className="text-lg font-semibold">No areas defined for this project</p>
                            <p className="text-sm">Manage project settings to add plots or levels.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  }

  // LEVEL 1: Project List Directory
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <LayoutGrid className="h-6 w-6 text-primary" />
                Quality Control Directory
            </h2>
            {profile?.permissions?.hasFullVisibility && (
                <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Administrative Oversight Active
                </div>
            )}
          </div>
           <AddChecklistToProject 
            projects={allowedProjects} 
            checklistTemplates={checklistTemplates} 
            subContractors={subContractors || []} 
            existingChecklists={checklistInstances}
          />
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allowedProjects.length > 0 ? (
            allowedProjects.map((project) => {
              const stats = projectProgress.get(project.id) || { total: 0, closed: 0 };
              const progress = stats.total > 0 ? (stats.closed / stats.total) * 100 : 0;
              return (
                <Card key={project.id} className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group" onClick={() => navigateToProject(project.id)}>
                    <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                            <Badge variant="secondary" className="gap-1 px-2 py-0.5">
                                <Building2 className="h-3 w-3" />
                                Project
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <CardTitle className="text-xl group-hover:text-primary transition-colors">{project.name}</CardTitle>
                        <CardDescription>{project.areas?.length || 0} Plots / Areas</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
                                <span>Global Progress</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
              <p className="text-lg font-semibold">No projects available</p>
              <p className="text-sm">You only see QC data for projects you are explicitly assigned to.</p>
            </div>
          )}
        </div>
      </div>
  );
}

export default function QualityControlPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Quality Control" />
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Suspense fallback={
            <div className="flex flex-col w-full h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <QualityControlContent />
        </Suspense>
      </main>
    </div>
  );
}
