
'use client';

import { Header } from '@/components/layout/header';
import { ChecklistCard } from './checklist-card';
import { AddChecklistToProject } from './add-checklist-to-project';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { QualityChecklist, Project, SubContractor, DistributionUser, Area } from '@/lib/types';
import { Loader2, ChevronRight, LayoutGrid, ClipboardCheck, Building2, MapPin, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

function QualityControlContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();

  const activeProjectId = searchParams.get('project');
  const activeAreaId = searchParams.get('area');

  // Profile check
  const profileRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Real-time data from Firestore
  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const checklistsQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), orderBy('createdAt', 'desc'))
  , [db]);
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

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  // Derived Data: Project Progress
  const projectProgress = useMemo(() => {
    if (!allChecklists) return new Map();
    const map = new Map();
    allChecklists.forEach(c => {
        if (c.isTemplate || !c.projectId) return;
        const current = map.get(c.projectId) || { total: 0, closed: 0 };
        const totalItems = c.items?.length || 0;
        const closedItems = c.items?.filter(i => i.status !== 'pending' && i.status !== 'no').length || 0;
        map.set(c.projectId, { total: current.total + totalItems, closed: current.closed + closedItems });
    });
    return map;
  }, [allChecklists]);

  // Derived Data: Area Progress
  const areaProgress = useMemo(() => {
    if (!allChecklists || !activeProjectId) return new Map();
    const map = new Map();
    allChecklists.forEach(c => {
        if (c.isTemplate || c.projectId !== activeProjectId || !c.areaId) return;
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
  }, [allChecklists, activeProjectId]);

  const checklistTemplates = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => !!c.isTemplate);
  }, [allChecklists]);

  const filteredChecklists = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => 
        !c.isTemplate && 
        c.projectId === activeProjectId &&
        c.areaId === activeAreaId
    );
  }, [allChecklists, activeProjectId, activeAreaId]);

  const navigateToProject = (id: string) => router.push(`/quality-control?project=${id}`);
  const navigateToArea = (id: string) => router.push(`/quality-control?project=${activeProjectId}&area=${id}`);
  const clearSelection = () => router.push('/quality-control');
  const clearArea = () => router.push(`/quality-control?project=${activeProjectId}`);

  const isLoading = projectsLoading || subsLoading || checklistsLoading || profileLoading;

  if (isLoading && !allChecklists) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // --- RENDERING LOGIC ---

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
                <AddChecklistToProject projects={allowedProjects} checklistTemplates={checklistTemplates} subContractors={subContractors || []} />
            </div>

            <div className="grid gap-4 md:gap-6">
                {filteredChecklists.length > 0 ? (
                    filteredChecklists.map((checklist) => (
                        <ChecklistCard
                            key={checklist.id}
                            checklist={checklist}
                            projects={allowedProjects}
                            subContractors={subContractors || []}
                        />
                    ))
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                        <p className="text-lg font-semibold">No checklists assigned to this plot</p>
                        <p className="text-sm">Assign a trade checklist to begin quality tracking.</p>
                    </div>
                )}
            </div>
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
                        <ArrowLeft className="h-4 w-4" /> All Projects
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        {project?.name || 'Project Overview'}
                    </h2>
                </div>
                <AddChecklistToProject projects={allowedProjects} checklistTemplates={checklistTemplates} subContractors={subContractors || []} />
            </div>

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
        </div>
    );
  }

  // LEVEL 1: Project List Directory
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Quality Control Directory
          </h2>
           <AddChecklistToProject projects={allowedProjects} checklistTemplates={checklistTemplates} subContractors={subContractors || []} />
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
