'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { useFirestore, useDoc, useUser, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InformationRequestCard } from '../information-request-card';

function RequestDetailContent() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const db = useFirestore();
  const { user: firebaseUser } = useUser();

  // Fetch current request
  const requestRef = useMemo(() => (db && id ? doc(db, 'information-requests', id) : null), [db, id]);
  const { data: item, isLoading: itemLoading } = useDoc<InformationRequest>(requestRef);

  // Fetch static lookups
  const projectsQuery = useMemo(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const usersQuery = useMemo(() => (db ? collection(db, 'users') : null), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // Fetch current user profile
  const currentUserRef = useMemo(() => {
    if (!db || !firebaseUser?.email) return null;
    return doc(db, 'users', firebaseUser.email.toLowerCase().trim());
  }, [db, firebaseUser?.email]);
  const { data: currentUser, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  const isLoading = itemLoading || projectsLoading || usersLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item || !currentUser) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-lg font-semibold">Request Not Found</p>
        <p className="text-muted-foreground">The record may have been deleted or moved.</p>
        <Button onClick={() => router.push('/information-requests')}>
          Return to Log
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => router.push('/information-requests')} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back to Log
        </Button>
      </div>
      <InformationRequestCard 
        item={item} 
        projects={allProjects || []} 
        distributionUsers={distributionUsers || []} 
        currentUser={currentUser}
        onDelete={() => router.push('/information-requests')}
      />
    </div>
  );
}

export default function InformationRequestDetailPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Header title="Information Request Detail" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
          <RequestDetailContent />
        </Suspense>
      </main>
    </div>
  );
}
