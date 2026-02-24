
'use client';

import { Header } from '@/components/layout/header';
import { ClientInstructionCard } from './instruction-card';
import { NewClientInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import type { ClientInstruction, Project, DistributionUser } from '@/lib/types';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';

function InstructionsContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;

  // Fetch profile for permission check and message sending
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
  // Create a stable key for the query dependency to prevent flickering/resubscribing
  const allowedProjectIdsKey = useMemo(() => allowedProjectIds.sort().join(','), [allowedProjectIds]);

  const instructionsQuery = useMemo(() => {
    if (!db || projectsLoading) return null;
    const base = collection(db, 'client-instructions');
    
    if (projectId) {
      // If filtering by a specific project, ensure it's allowed
      if (!allowedProjectIdsKey.split(',').includes(projectId)) return null;
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    
    // Default: fetch all (we filter client-side for precision)
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId, allowedProjectIdsKey, projectsLoading]);

  const { data: allInstructions, isLoading: instructionsLoading } = useCollection<ClientInstruction>(instructionsQuery);

  const filteredInstructions = useMemo(() => {
    if (!allInstructions) return [];
    // Strict client-side filter to ensure no data leaks during query transitions
    const authorizedIds = allowedProjectIdsKey.split(',').filter(Boolean);
    return allInstructions.filter(inst => authorizedIds.includes(inst.projectId));
  }, [allInstructions, allowedProjectIdsKey]);

  const isLoading = usersLoading || projectsLoading || instructionsLoading || profileLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  if (!profile) {
    return (
        <div className="text-center py-12 space-y-4">
            <p className="text-lg font-semibold">Profile Required</p>
            <p>Access to client documentation requires an internal profile for: <strong>{sessionUser?.email}</strong></p>
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className='flex flex-col gap-1'>
            <h2 className="text-2xl font-bold tracking-tight">
              Client Instruction Log
            </h2>
            {hasFullVisibility && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3" />
                    Administrative Visibility Active
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NewClientInstruction projects={allowedProjects} distributionUsers={distributionUsers || []} />
          </div>
        </div>
        <InstructionFilters projects={allowedProjects} />
        <div className="grid gap-4 md:gap-6">
          {filteredInstructions.length > 0 ? (
            filteredInstructions.map((instruction) => (
              <ClientInstructionCard
                key={instruction.id}
                instruction={instruction}
                projects={allowedProjects}
                currentUser={profile}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
              <p className="text-lg font-semibold">No directives recorded</p>
              <p className="text-sm">Log requests directly from the client to ensure clear implementation.</p>
            </div>
          )}
        </div>
        {filteredInstructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={filteredInstructions} projects={allowedProjects} />
          </div>
        )}
      </main>
  );
}

export default function ClientInstructionsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Client Instructions" />
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
