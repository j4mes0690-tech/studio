'use client';

import { Header } from '@/components/layout/header';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';
import { NoticeTable } from './notice-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { CleanUpNotice, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function CleanUpContent() {
  const searchParams = searchParams || useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;

  const [isCompact, setIsCompact] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_cleanup_notices');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_cleanup_notices', String(newVal));
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

  const isLoading = projectsLoading || subsLoading || noticesLoading || profileLoading;

  if (isLoading && !allNotices) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Notice Log
          </h2>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={toggleView}
                    className="flex h-9 w-9"
                  >
                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {isCompact ? 'Card' : 'Compact'} View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <NewNotice 
              projects={allowedProjects} 
              subContractors={subContractors || []} 
              allNotices={allNotices || []}
              allUsers={allUsers || []}
            />
          </div>
        </div>
        <NoticeFilters projects={allowedProjects} />
        
        {filteredNotices.length > 0 ? (
          isCompact ? (
            <NoticeTable 
              items={filteredNotices}
              projects={allowedProjects}
              subContractors={subContractors || []}
              allUsers={allUsers || []}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {filteredNotices.map((notice) => (
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
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
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
