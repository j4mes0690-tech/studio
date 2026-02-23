
'use client';

import { Header } from '@/components/layout/header';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import type { Instruction, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';

function InstructionsContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;

  // Fetch profile for permission check
  const profileRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Fetch data
  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  // Filter allowed projects
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.canManageProjects) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => p.assignedUsers?.includes(email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const instructionsQuery = useMemo(() => {
    const base = collection(db, 'instructions');
    if (projectId) {
      // If filtering by a specific project, it must be in the allowed list
      if (!allowedProjectIds.includes(projectId)) return null;
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    // We fetch all and then filter client side because Firestore doesn't support easy "in array" for multiple IDs combined with orderBy easily in simple queries without more complex structure
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId, allowedProjectIds]);

  const { data: allInstructions, isLoading: instructionsLoading } = useCollection<Instruction>(instructionsQuery);

  const filteredInstructions = useMemo(() => {
    if (!allInstructions) return [];
    return allInstructions.filter(inst => allowedProjectIds.includes(inst.projectId));
  }, [allInstructions, allowedProjectIds]);

  const isLoading = usersLoading || projectsLoading || instructionsLoading || profileLoading;

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
            Instruction Log
          </h2>
          <div className="flex items-center gap-2">
            <NewInstruction projects={allowedProjects || []} distributionUsers={distributionUsers || []} />
          </div>
        </div>
        <InstructionFilters projects={allowedProjects || []} />
        <div className="grid gap-4 md:gap-6">
          {filteredInstructions && filteredInstructions.length > 0 ? (
            filteredInstructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
                projects={allowedProjects || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No instructions found for your assigned projects.</p>
              <p className="text-sm">Record new instructions or check your project assignments.</p>
            </div>
          )}
        </div>
        {filteredInstructions && filteredInstructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={filteredInstructions} projects={allowedProjects || []} />
          </div>
        )}
      </main>
  );
}

export default function InstructionsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Instructions" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <InstructionsContent />
      </Suspense>
    </div>
  );
}
