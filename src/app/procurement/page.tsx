'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { ProcurementItem, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, ShoppingCart, LayoutGrid, List, ShieldCheck, Building2, ChevronRight, ArrowLeft, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProcurementFilters } from './procurement-filters';
import { ProcurementCard } from './procurement-card';
import { ProcurementTable } from './procurement-table';
import { NewProcurementDialog } from './new-item';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function ProcurementContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  
  const activeProjectId = searchParams.get('project');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_procurement');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_procurement', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db) ? collection(db, 'projects') : null, [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db) ? collection(db, 'sub-contractors') : null, [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const procurementQuery = useMemoFirebase(() => (db) ? query(collection(db, 'procurement-items'), orderBy('createdAt', 'desc')) : null, [db]);
  const { data: allProcurement, isLoading: procLoading } = useCollection<ProcurementItem>(procurementQuery);

  // Security & Visibility
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const projectStats = useMemo(() => {
    const map = new Map<string, number>();
    if (!allProcurement) return map;
    allProcurement.forEach(item => {
      const current = map.get(item.projectId) || 0;
      map.set(item.projectId, current + 1);
    });
    return map;
  }, [allProcurement]);

  const filteredItems = useMemo(() => {
    if (!allProcurement || !activeProjectId) return [];
    return allProcurement.filter(item => {
      const isProjectMatch = item.projectId === activeProjectId;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return isProjectMatch && matchesStatus;
    });
  }, [allProcurement, activeProjectId, statusFilter]);

  const currentProject = useMemo(() => allowedProjects.find(p => p.id === activeProjectId), [allowedProjects, activeProjectId]);

  const navigateToProject = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('project', id);
    router.push(`/procurement?${params.toString()}`);
  };

  const clearSelection = () => {
    router.push('/procurement');
  };

  if (procLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  // LEVEL 2: Project-Specific Schedule
  if (activeProjectId && currentProject) {
    return (
      <div className="flex flex-col w-full gap-6 p-4 md:p-8">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={clearSelection} className="mb-2 -ml-2 text-muted-foreground h-8 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Project Directory
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{currentProject.name}</h2>
                <p className="text-sm text-muted-foreground">Trade procurement schedule and milestone tracking.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={toggleView}>
                      {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Switch to {isCompact ? 'Card' : 'Compact'} View</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <NewProcurementDialog 
                projects={allowedProjects} 
                subContractors={allSubContractors || []} 
                allProcurement={allProcurement || []}
                currentUser={profile}
                initialProjectId={activeProjectId}
              />
            </div>
          </div>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-sm font-medium shrink-0">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filter Schedule:
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[250px] bg-background">
                <SelectValue placeholder="Any Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="enquiry">Enquiry Issued</SelectItem>
                <SelectItem value="tender-returned">Tender Returned</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="on-site">Start on Site</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredItems.length > 0 ? (
            isCompact ? (
              <ProcurementTable 
                items={filteredItems} 
                projects={allowedProjects} 
                subContractors={allSubContractors || []}
                currentUser={profile}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredItems.map(item => (
                      <ProcurementCard 
                          key={item.id} 
                          item={item} 
                          project={currentProject}
                          projects={allowedProjects}
                          subContractors={allSubContractors || []}
                          currentUser={profile}
                      />
                  ))}
              </div>
            )
          ) : (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">No trade packages defined</p>
              <p className="text-sm">Log your first trade package to begin tracking procurement milestones.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LEVEL 1: Project Directory
  return (
    <div className="flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Procurement Directory
          </h2>
          <p className="text-sm text-muted-foreground">Select a project to manage its trade procurement schedule.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <NewProcurementDialog 
          projects={allowedProjects} 
          subContractors={allSubContractors || []} 
          allProcurement={allProcurement || []}
          currentUser={profile}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowedProjects.length > 0 ? allowedProjects.map(project => {
          const count = projectStats.get(project.id) || 0;
          return (
            <Card 
              key={project.id} 
              className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md group"
              onClick={() => navigateToProject(project.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="gap-1 px-2 py-0.5 bg-primary/5 text-primary border-primary/10 uppercase text-[9px] font-black tracking-widest">
                    <Building2 className="h-3 w-3" />
                    Project
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{project.name}</CardTitle>
                <CardDescription>{count} Trade Packages Tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground pt-2 border-t">
                  <span>View Full Schedule</span>
                  <ShoppingCart className="h-3 w-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold text-muted-foreground">No projects found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Procurement Schedule" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <ProcurementContent />
      </Suspense>
    </div>
  );
}
