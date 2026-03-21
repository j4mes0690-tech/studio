'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { useFirestore, useDoc, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Instruction, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstructionCard } from '../instruction-card';

function InstructionDetailContent() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const db = useFirestore();
  const { user: firebaseUser } = useUser();

  // Fetch current instruction
  const instructionRef = useMemoFirebase(() => (db && id ? doc(db, 'instructions', id) : null), [db, id]);
  const { data: item, isLoading: itemLoading } = useDoc<Instruction>(instructionRef);

  // Fetch lookups
  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  // Fetch current user profile
  const currentUserRef = useMemoFirebase(() => {
    if (!db || !firebaseUser?.email) return null;
    return doc(db, 'users', firebaseUser.email.toLowerCase().trim());
  }, [db, firebaseUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  const isLoading = itemLoading || projectsLoading || usersLoading || subsLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item || !profile) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-lg font-semibold">Instruction Not Found</p>
        <p className="text-muted-foreground">The record may have been deleted or moved.</p>
        <Button onClick={() => router.push('/instructions')}>
          Return to Log
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => router.push('/instructions')} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Log
        </Button>
      </div>
      <InstructionCard 
        instruction={item} 
        projects={allProjects || []} 
        distributionUsers={distributionUsers || []} 
        subContractors={subContractors || []}
        onDelete={() => router.push('/instructions')}
      />
    </div>
  );
}

export default function SiteInstructionDetailPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Header title="Site Instruction Detail" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <InstructionDetailContent />
        </Suspense>
      </main>
    </div>
  );
}
