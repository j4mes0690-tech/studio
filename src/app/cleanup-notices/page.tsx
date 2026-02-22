'use client';

import { Header } from '@/components/layout/header';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { CleanUpNotice, Project, SubContractor } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

export default function CleanUpNoticesPage() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const projectId = searchParams.get('project') || undefined;

  // Real-time data from Firestore
  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const noticesQuery = useMemo(() => {
    const base = collection(db, 'cleanup-notices');
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: notices, isLoading: noticesLoading } = useCollection<CleanUpNotice>(noticesQuery);

  const isLoading = projectsLoading || subsLoading || noticesLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Clean Up Notices" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Notice Log
          </h2>
          <div className="flex items-center gap-2">
            <NewNotice projects={projects || []} subContractors={subContractors || []} />
          </div>
        </div>
        <NoticeFilters projects={projects || []} />
        <div className="grid gap-4 md:gap-6">
          {notices && notices.length > 0 ? (
            notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                projects={projects || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No clean up notices found.</p>
              <p className="text-sm">Record issues that require cleaning on site.</p>
            </div>
          )}
        </div>
        {notices && notices.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton notices={notices} projects={projects || []} />
          </div>
        )}
      </main>
    </div>
  );
}
