
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getInstructions, getDistributionUsers } from '@/lib/data';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Instruction, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function InstructionsPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;

  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [distributionUsers, setDistributionUsers] = useState<DistributionUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [inst, proj, users] = await Promise.all([
        getInstructions({ projectId }),
        getProjects(),
        getDistributionUsers(),
      ]);
      setInstructions(inst);
      setAllProjects(proj);
      setDistributionUsers(users);
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
      <Header title="Instructions" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Instruction Log
          </h2>
          <div className="flex items-center gap-2">
            <NewInstruction projects={allProjects} distributionUsers={distributionUsers} />
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
