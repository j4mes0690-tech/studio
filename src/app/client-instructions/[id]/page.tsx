'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { ClientInstruction, Project, DistributionUser, Instruction, InformationRequest } from '@/lib/types';
import { Loader2, ChevronLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientInstructionCard } from '../instruction-card';
import { Badge } from '@/components/ui/badge';

function ClientInstructionDetailContent() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const { user: firebaseUser } = useUser();

  // Detect if we are in view-only mode (linked from another module)
  const isViewOnly = searchParams.get('mode') === 'view';

  // Fetch current instruction
  const instructionRef = useMemoFirebase(() => (db && id ? doc(db, 'client-instructions', id) : null), [db, id]);
  const { data: item, isLoading: itemLoading } = useDoc<ClientInstruction>(instructionRef);

  // Fetch lookups
  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // REFERENCES DATA: For sequential reference generation in the Accept dialog
  const siteInstructionsQuery = useMemoFirebase(() => db ? collection(db, 'instructions') : null, [db]);
  const { data: allSiteInstructions } = useCollection<Instruction>(siteInstructionsQuery);

  const rfisQuery = useMemoFirebase(() => db ? collection(db, 'information-requests') : null, [db]);
  const { data: allRfis } = useCollection<InformationRequest>(rfisQuery);

  // Fetch current user profile
  const currentUserRef = useMemoFirebase(() => {
    if (!db || !firebaseUser?.email) return null;
    return doc(db, 'users', firebaseUser.email.toLowerCase().trim());
  }, [db, firebaseUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  const isLoading = itemLoading || projectsLoading || usersLoading || profileLoading;

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
        <p className="text-lg font-semibold">Directive Not Found</p>
        <p className="text-muted-foreground">The record may have been deleted or moved.</p>
        <Button onClick={() => router.push('/client-instructions')}>
          Return to Log
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {isViewOnly && (
          <Badge variant="outline" className="bg-muted/50 gap-1.5 px-3 py-1 font-bold text-muted-foreground border-dashed">
            <Eye className="h-3.5 w-3.5" />
            READ ONLY VIEW
          </Badge>
        )}
      </div>
      <ClientInstructionCard 
        instruction={item} 
        projects={allProjects || []} 
        currentUser={profile}
        allSiteInstructions={allSiteInstructions || []}
        allRfis={allRfis || []}
        readOnly={isViewOnly}
      />
    </div>
  );
}

export default function ClientInstructionDetailPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Header title="Client Directive Detail" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <ClientInstructionDetailContent />
        </Suspense>
      </main>
    </div>
  );
}
