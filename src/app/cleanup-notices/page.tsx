
'use client';

import { Header } from '@/components/layout/header';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import type { CleanUpNotice, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';

function CleanUpContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;

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

  // Visibility logic
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    
    // Decoupled canManageProjects from visibility. Only hasFullVisibility grants global oversight.
    if (profile.permissions?.hasFullVisibility) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const noticesQuery = useMemo(() => {
    if (!db || projectsLoading) return null;
    const base = collection(db, 'cleanup-notices');
    if (projectId) {
      if (!allowedProjectIds.includes(projectId)) return null;
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId, allowedProjectIds, projectsLoading]);

  const { data: allNotices, isLoading: noticesLoading } = useCollection<CleanUpNotice>(noticesQuery);

  const filteredNotices = useMemo(() => {
    if (!allNotices) return [];
    return allNotices.filter(n => allowedProjectIds.includes(n.projectId));
  }, [allNotices, allowedProjectIds]);

  const isLoading = projectsLoading || subsLoading || noticesLoading || profileLoading;

  if (isLoading) {
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
            <NewNotice projects={allowedProjects} subContractors={subContractors || []} />
          </div>
        </div>
        <NoticeFilters projects={allowedProjects} />
        <div className="grid gap-4 md:gap-6">
          {filteredNotices.length > 0 ? (
            filteredNotices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                projects={allowedProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-lg font-semibold">No records found</p>
              <p className="text-sm">You only see cleanup notices for projects you are assigned to.</p>
            </div>
          )}
        </div>
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
