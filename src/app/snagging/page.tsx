
'use client';

import { Header } from '@/components/layout/header';
import { SnaggingItemCard } from './snagging-card';
import { NewSnaggingItem } from './new-snagging-item';
import { SnaggingFilters } from './snagging-filters';
import { SnaggingTable } from './snagging-table';
import { ProjectReportButton } from './project-report-button';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { SnaggingItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List, ShieldCheck, Layers, LayoutList } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function SnaggingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;
  const areaId = searchParams.get('area') || undefined;
  
  const [isCompact, setIsCompact] = useState(false);
  const [isGroupedByProject, setIsGroupedByProject] = useState(false);

  // Load persistence
  useEffect(() => {
    const savedView = localStorage.getItem('sitecommand_view_snagging');
    if (savedView !== null) {
      setIsCompact(savedView === 'true');
    }
    const savedGrouping = localStorage.getItem('sitecommand_grouping_snagging');
    if (savedGrouping !== null) {
      setIsGroupedByProject(savedGrouping === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_snagging', String(newVal));
  };

  const toggleGrouping = () => {
    const newVal = !isGroupedByProject;
    setIsGroupedByProject(newVal);
    localStorage.setItem('sitecommand_grouping_snagging', String(newVal));
  };

  // Profile check
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Lookups
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

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  // STABLE QUERY: Fetch all by date to avoid composite index requirements
  const snaggingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'snagging-items'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allItems, isLoading: snaggingLoading } = useCollection<SnaggingItem>(snaggingQuery);

  // SECURITY & PROJECT FILTER (Client-side)
  const filteredItems = useMemo(() => {
    if (!allItems || !profile || !allProjects) return [];
    
    const email = profile.email.toLowerCase().trim();
    const subId = profile.subContractorId;
    const hasFullVisibility = !!profile.permissions?.hasFullVisibility;

    const allowedProjectIds = allProjects
        .filter(p => {
            if (hasFullVisibility) return true;
            const assignments = p.assignedUsers || [];
            return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
        })
        .map(p => p.id);

    return allItems.filter(list => {
        const isProjectAllowed = allowedProjectIds.includes(list.projectId);
        if (!isProjectAllowed) return false;

        if (hasFullVisibility || profile.userType === 'internal') return true;

        // For partners, only show if at least one item in the list is assigned to their company
        return subId ? list.items.some(item => item.subContractorId === subId) : false;
    }).filter(item => {
        const matchesProject = projectId ? item.projectId === projectId : true;
        const matchesArea = areaId ? (areaId === 'other' ? (!item.areaId || item.areaId === 'other') : item.areaId === areaId) : true;
        return matchesProject && matchesArea;
    });
  }, [allItems, profile, allProjects, projectId, areaId]);

  // GROUPING LOGIC: Aggregated by Project
  const displayItems = useMemo(() => {
    if (!isGroupedByProject) return filteredItems;

    const projectMap = new Map<string, any>();

    filteredItems.forEach(list => {
      if (!projectMap.has(list.projectId)) {
        const p = allProjects?.find(proj => proj.id === list.projectId);
        projectMap.set(list.projectId, {
          id: `aggregated-${list.projectId}`,
          projectId: list.projectId,
          title: p?.name || 'Project Overview',
          createdAt: list.createdAt,
          items: [],
          photos: [],
          isProjectAggregation: true
        });
      }
      const entry = projectMap.get(list.projectId);
      entry.items.push(...(list.items || []));
      if (list.photos) entry.photos.push(...list.photos);
      // Sort by latest activity
      if (new Date(list.createdAt) > new Date(entry.createdAt)) {
        entry.createdAt = list.createdAt;
      }
    });

    return Array.from(projectMap.values());
  }, [filteredItems, isGroupedByProject, allProjects]);

  const isLoading = projectsLoading || snaggingLoading || subsLoading || profileLoading;

  if (isLoading && !allItems) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;
  const allowedProjects = allProjects?.filter(p => {
      if (hasFullVisibility) return true;
      const email = profile?.email.toLowerCase().trim();
      return (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email);
  }) || [];

  return (
    <main className="flex-1 p-3 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className='flex flex-col gap-1'>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {isGroupedByProject ? 'Project Snagging Status' : 'Snagging Log'}
            </h2>
            {hasFullVisibility && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3" />
                    <span className="hidden xs:inline">Administrative Visibility Active</span>
                    <span className="xs:hidden">Admin Access</span>
                </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <NewSnaggingItem 
              projects={allowedProjects} 
              subContractors={subContractors || []} 
              allSnaggingLists={allItems || []}
            />

            {allowedProjects.length > 0 && (
              <ProjectReportButton 
                  projects={allowedProjects} 
                  allSnaggingLists={allItems || []}
                  subContractors={subContractors || []}
                  allUsers={allUsers || []}
                  initialProjectId={projectId}
              />
            )}

            <div className="flex items-center border rounded-md p-0.5 bg-muted/20">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={isGroupedByProject ? "ghost" : "secondary"} 
                                size="icon" 
                                onClick={() => { if(isGroupedByProject) toggleGrouping(); }}
                                className={cn("h-9 w-9", !isGroupedByProject && "bg-background shadow-sm")}
                            >
                                <LayoutList className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Individual Audit Lists</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={isGroupedByProject ? "secondary" : "ghost"} 
                                size="icon" 
                                onClick={() => { if(!isGroupedByProject) toggleGrouping(); }}
                                className={cn("h-9 w-9", isGroupedByProject && "bg-background shadow-sm")}
                            >
                                <Layers className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Group by Project</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleView}
                    className="flex h-9 w-9 shrink-0"
                  >
                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {isCompact ? 'Card' : 'Compact'} View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <SnaggingFilters projects={allowedProjects} />

        {displayItems.length > 0 ? (
          isCompact ? (
            <div className="overflow-x-auto">
                <SnaggingTable 
                items={displayItems}
                projects={allProjects || []}
                subContractors={subContractors || []}
                allUsers={allUsers || []}
                />
            </div>
          ) : (
            <div className="grid gap-4 md:gap-6">
              {displayItems.map((item) => (
                <SnaggingItemCard
                  key={item.id}
                  item={item}
                  projects={allProjects || []}
                  subContractors={subContractors || []}
                  allUsers={allUsers || []}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 px-4 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
            <p className="text-lg font-semibold">No records found</p>
            <p className="text-sm">You only see snagging data for projects you are explicitly assigned to.</p>
          </div>
        )}
      </main>
  );
}

export default function SnaggingPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Snagging Lists" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <SnaggingContent />
      </Suspense>
    </div>
  );
}
