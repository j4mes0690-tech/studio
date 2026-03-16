'use client';

import { Header } from '@/components/layout/header';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';
import { NoticeTable } from './notice-table';
import { ProjectReportButton } from './project-report-button';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { CleanUpNotice, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List, ShieldCheck, Layers, LayoutList } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function CleanUpContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;

  const [isCompact, setIsCompact] = useState(false);
  const [isGroupedByProject, setIsGroupedByProject] = useState(false);

  // Load persistence
  useEffect(() => {
    const savedView = localStorage.getItem('sitecommand_view_cleanup_notices');
    if (savedView !== null) {
      setIsCompact(savedView === 'true');
    }
    const savedGrouping = localStorage.getItem('sitecommand_grouping_cleanup');
    if (savedGrouping !== null) {
      setIsGroupedByProject(savedGrouping === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_cleanup_notices', String(newVal));
  };

  const toggleGrouping = () => {
    const newVal = !isGroupedByProject;
    setIsGroupedByProject(newVal);
    localStorage.setItem('sitecommand_grouping_cleanup', String(newVal));
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

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

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

  // STABLE QUERY: Fetch all by date to avoid composite index requirements
  const noticesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'cleanup-notices'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allNotices, isLoading: noticesLoading } = useCollection<CleanUpNotice>(noticesQuery);

  // CLIENT-SIDE FILTERING (Security & Selection)
  const filteredNotices = useMemo(() => {
    if (!allNotices) return [];
    return allNotices.filter(n => {
        const isAllowed = allowedProjectIds.includes(n.projectId);
        const matchesFilter = projectId ? n.projectId === projectId : true;
        return isAllowed && matchesFilter;
    });
  }, [allNotices, allowedProjectIds, projectId]);

  // GROUPING LOGIC: Aggregated by Project
  const displayItems = useMemo(() => {
    if (!isGroupedByProject) return filteredNotices;

    const projectMap = new Map<string, any>();

    filteredNotices.forEach(notice => {
      if (!projectMap.has(notice.projectId)) {
        const p = allProjects?.find(proj => proj.id === notice.projectId);
        projectMap.set(notice.projectId, {
          id: `aggregated-${notice.projectId}`,
          projectId: notice.projectId,
          title: p?.name || 'Project Overview',
          createdAt: notice.createdAt,
          items: [],
          photos: [],
          status: 'issued',
          isProjectAggregation: true
        });
      }
      const entry = projectMap.get(notice.projectId);
      entry.items.push(...(notice.items || []));
      if (notice.photos) entry.photos.push(...notice.photos);
      if (new Date(notice.createdAt) > new Date(entry.createdAt)) {
        entry.createdAt = notice.createdAt;
      }
    });

    return Array.from(projectMap.values());
  }, [filteredNotices, isGroupedByProject, allProjects]);

  const isLoading = (projectsLoading || subsLoading || noticesLoading || profileLoading) && !allNotices;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="flex-1 p-3 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className='flex flex-col gap-1'>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {isGroupedByProject ? 'Project Clean Up Status' : 'Notice Log'}
            </h2>
            {profile?.permissions?.hasFullVisibility && (
                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Administrative Visibility Active</span>
                </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <NewNotice 
              projects={allowedProjects} 
              subContractors={subContractors || []} 
              allNotices={allNotices || []}
            />

            {allowedProjects.length > 0 && (
              <ProjectReportButton 
                  projects={allowedProjects} 
                  allNotices={allNotices || []}
                  subContractors={subContractors || []}
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
                        <TooltipContent><p>Individual Notice Lists</p></TooltipContent>
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

        <NoticeFilters projects={allowedProjects} />
        
        {displayItems.length > 0 ? (
          isCompact ? (
            <NoticeTable 
              items={displayItems}
              projects={allowedProjects}
              subContractors={subContractors || []}
              allUsers={allUsers || []}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {displayItems.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  projects={allowedProjects}
                  subContractors={subContractors || []}
                  allUsers={allUsers || []}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
            <p className="text-lg font-semibold">No records found</p>
            <p className="text-sm">You only see cleanup notices for projects you are assigned to.</p>
          </div>
        )}

        {filteredNotices.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton notices={filteredNotices} projects={allowedProjects} />
          </div>
        )}
      </main>
  );
}

export default function CleanUpNoticesPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Clean Up Notices" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <CleanUpContent />
      </Suspense>
    </div>
  );
}
