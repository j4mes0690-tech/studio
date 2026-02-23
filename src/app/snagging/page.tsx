
'use client';

import { Header } from '@/components/layout/header';
import { SnaggingItemCard } from './snagging-card';
import { NewSnaggingItem } from './new-snagging-item';
import { SnaggingFilters } from './snagging-filters';
import { useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import type { SnaggingItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';

function SnaggingContent() {
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
    if (profile.permissions?.canManageProjects) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const snaggingQuery = useMemo(() => {
    if (!db || projectsLoading) return null;
    const base = collection(db, 'snagging-items');
    if (projectId) {
      if (!allowedProjectIds.includes(projectId)) return null;
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId, allowedProjectIds, projectsLoading]);

  const { data: allItems, isLoading: snaggingLoading } = useCollection<SnaggingItem>(snaggingQuery);

  const filteredItems = useMemo(() => {
    if (!allItems) return [];
    return allItems.filter(item => allowedProjectIds.includes(item.projectId));
  }, [allItems, allowedProjectIds]);

  const isLoading = projectsLoading || snaggingLoading || subsLoading || profileLoading;

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
          <h2 className="text-2xl font-bold tracking-tight">Snagging Log</h2>
          <div className="flex items-center gap-2">
            <NewSnaggingItem projects={allowedProjects} subContractors={subContractors || []} />
          </div>
        </div>
        <SnaggingFilters projects={allowedProjects} />
        <div className="grid gap-4 md:gap-6">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <SnaggingItemCard
                key={item.id}
                item={item}
                projects={allowedProjects}
                subContractors={subContractors || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-lg font-semibold">No records found</p>
              <p className="text-sm">You only see snagging lists for projects you are explicitly assigned to.</p>
            </div>
          )}
        </div>
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
