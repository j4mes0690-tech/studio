
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getCleanUpNotices, getSubContractors } from '@/lib/data';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CleanUpNotice, Project, SubContractor } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function CleanUpNoticesPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;

  const [notices, setNotices] = useState<CleanUpNotice[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [subContractors, setSubContractors] = useState<SubContractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [nots, proj, subs] = await Promise.all([
        getCleanUpNotices({ projectId }),
        getProjects(),
        getSubContractors(),
      ]);
      setNotices(nots);
      setAllProjects(proj);
      setSubContractors(subs);
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  if (loading) {
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
            <NewNotice projects={allProjects} subContractors={subContractors} />
          </div>
        </div>
        <NoticeFilters projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                projects={allProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No clean up notices found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new notice.</p>
            </div>
          )}
        </div>
        {notices.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton notices={notices} projects={allProjects} />
          </div>
        )}
      </main>
    </div>
  );
}
