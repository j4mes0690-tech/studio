
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getInformationRequests } from '@/lib/data';
import { InformationRequestCard } from './information-request-card';
import { NewInformationRequest } from './new-information-request';
import { InformationRequestFilters } from './information-request-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function InformationRequestsPage() {
  const { user: firebaseUser } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;

  // Fetch distribution users from Firestore
  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const [items, setItems] = useState<InformationRequest[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [reqs, proj] = await Promise.all([
        getInformationRequests({ projectId }),
        getProjects(),
      ]);
      setItems(reqs);
      setAllProjects(proj);
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  const currentUser = useMemo(() => {
    if (!firebaseUser?.email || !distributionUsers) return null;
    return distributionUsers.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase()) || null;
  }, [firebaseUser, distributionUsers]);

  if (loading || usersLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!currentUser) {
    return (
        <div className="flex flex-col w-full">
            <Header title="Information Requests" />
            <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
                <div className="text-center space-y-4">
                    <p>Access restricted. Could not find an internal profile for: <strong>{firebaseUser?.email}</strong></p>
                    <p className="text-sm text-muted-foreground">Please ensure your email is added to the Distribution List in Settings.</p>
                </div>
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Information Requests" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Information Request Log
          </h2>
          <div className="flex items-center gap-2">
            <NewInformationRequest projects={allProjects} distributionUsers={distributionUsers || []} />
          </div>
        </div>
        <InformationRequestFilters projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {items.length > 0 ? (
            items.map((item) => (
              <InformationRequestCard
                key={item.id}
                item={item}
                projects={allProjects}
                distributionUsers={distributionUsers || []}
                currentUser={currentUser}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No information requests found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new item.</p>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={items} projects={allProjects} distributionUsers={distributionUsers || []} />
          </div>
        )}
      </main>
    </div>
  );
}
