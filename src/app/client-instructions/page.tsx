
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

  // Fetch profile for permission check
  const profileRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Fetch static lookups
  const usersQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const projectsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  // STABLE QUERY: Persistent listener for the collection.
  const instructionsQuery = useMemo(() => {
    if (!db) return null;
    const base = collection(db, 'client-instructions');
    
    // We apply the project filter at the Firestore query level if explicitly selected via URL.
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: allInstructions, isLoading: instructionsLoading } = useCollection<ClientInstruction>(instructionsQuery);

  // SECURITY & VISIBILITY: Client-side filtering ensures that the listener remains stable
  // even if project assignments or permissions are refreshing in the background.
  const filteredInstructions = useMemo(() => {
    // If we're loading and have NO data, return null to show the loader.
    // If we have data but something is re-loading, keep the existing filtered list.
    if (!allInstructions) return [];
    if (!profile || !allProjects) return allInstructions; // Fallback during sync

    const email = profile.email.toLowerCase().trim();
    const hasFullVisibility = !!profile.permissions?.hasFullVisibility;

    const allowedProjectIds = allProjects
        .filter(p => {
            if (hasFullVisibility) return true;
            const assignments = p.assignedUsers || [];
            return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
        })
        .map(p => p.id);

    return allInstructions.filter(inst => allowedProjectIds.includes(inst.projectId));
  }, [allInstructions, profile, allProjects]);

  const isLoading = (usersLoading || projectsLoading || instructionsLoading || profileLoading) && !allInstructions;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!profile && !profileLoading) {
    return (
        <div className="text-center py-12 space-y-4">
            <p className="text-lg font-semibold">Profile Required</p>
            <p>Access to client documentation requires an internal profile for: <strong>{sessionUser?.email}</strong></p>
        </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;
  const allowedProjects = allProjects?.filter(p => {
      if (hasFullVisibility) return true;
      const email = profile?.email.toLowerCase().trim();
      return (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email);
  }) || [];

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
                projects={allProjects || []}
                currentUser={profile!}
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
            <ExportButton instructions={filteredInstructions} projects={allProjects || []} />
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
