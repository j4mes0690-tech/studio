
'use client';

import { Header } from '@/components/layout/header';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { Instruction, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

export default function InstructionsPage() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const projectId = searchParams.get('project') || undefined;

  // Fetch data directly from Firestore
  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const instructionsQuery = useMemo(() => {
    const base = collection(db, 'instructions');
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: instructions, isLoading: instructionsLoading } = useCollection<Instruction>(instructionsQuery);

  const isLoading = usersLoading || projectsLoading || instructionsLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Instructions" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Instruction Log
          </h2>
          <div className="flex items-center gap-2">
            <NewInstruction projects={projects || []} distributionUsers={distributionUsers || []} />
          </div>
        </div>
        <InstructionFilters projects={projects || []} />
        <div className="grid gap-4 md:gap-6">
          {instructions && instructions.length > 0 ? (
            instructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
                projects={projects || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No instructions found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new instruction.</p>
            </div>
          )}
        </div>
        {instructions && instructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={instructions} projects={projects || []} />
          </div>
        )}
      </main>
    </div>
  );
}
