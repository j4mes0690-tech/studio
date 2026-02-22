'use client';

import { Header } from '@/components/layout/header';
import { SnaggingItemCard } from './snagging-card';
import { NewSnaggingItem } from './new-snagging-item';
import { SnaggingFilters } from './snagging-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

export default function SnaggingPage() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const projectId = searchParams.get('project') || undefined;

  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const snaggingQuery = useMemo(() => {
    const base = collection(db, 'snagging-items');
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: items, isLoading: snaggingLoading } = useCollection<SnaggingItem>(snaggingQuery);

  const isLoading = projectsLoading || snaggingLoading || subsLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Snagging Lists" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Snagging Log</h2>
          <div className="flex items-center gap-2">
            <NewSnaggingItem projects={projects || []} subContractors={subContractors || []} />
          </div>
        </div>
        <SnaggingFilters projects={projects || []} />
        <div className="grid gap-4 md:gap-6">
          {items && items.length > 0 ? (
            items.map((item) => (
              <SnaggingItemCard
                key={item.id}
                item={item}
                projects={projects || []}
                subContractors={subContractors || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No snagging items found.</p>
              <p className="text-sm">Record items that need correction on site.</p>
            </div>
          )}
        </div>
        {items && items.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={items} projects={projects || []} />
          </div>
        )}
      </main>
    </div>
  );
}
