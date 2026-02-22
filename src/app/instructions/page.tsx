
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getInstructions } from '@/lib/data';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Instruction, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function InstructionsPage() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const projectId = searchParams.get('project') || undefined;

  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [inst, proj] = await Promise.all([
        getInstructions({ projectId }),
        getProjects(),
      ]);
      setInstructions(inst);
      setAllProjects(proj);
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  if (loading || usersLoading) {
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
            <NewInstruction projects={allProjects} distributionUsers={distributionUsers || []} />
          </div>
        </div>
        <InstructionFilters projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {instructions.length > 0 ? (
            instructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
                projects={allProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No instructions found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new instruction.</p>
            </div>
          )}
        </div>
        {instructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={instructions} projects={allProjects} />
          </div>
        )}
      </main>
    </div>
  );
}
