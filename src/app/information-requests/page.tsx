
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getInformationRequests, getDistributionUsers } from '@/lib/data';
import { InformationRequestCard } from './information-request-card';
import { NewInformationRequest } from './new-information-request';
import { InformationRequestFilters } from './information-request-filters';
import { ExportButton } from './export-button';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';

export default function InformationRequestsPage() {
  const { user: firebaseUser } = useUser();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;

  const [items, setItems] = useState<InformationRequest[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [distributionUsers, setDistributionUsers] = useState<DistributionUser[]>([]);
  const [currentUser, setCurrentUser] = useState<DistributionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [reqs, proj, users] = await Promise.all([
        getInformationRequests({ projectId }),
        getProjects(),
        getDistributionUsers(),
      ]);
      setItems(reqs);
      setAllProjects(proj);
      setDistributionUsers(users);
      
      if (firebaseUser?.email) {
        const profile = users.find(u => u.email === firebaseUser.email);
        setCurrentUser(profile || null);
      }
      
      setLoading(false);
    }
    loadData();
  }, [projectId, firebaseUser]);

  if (loading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // If we can't find a matching profile for the logged in user, show a warning
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
            <NewInformationRequest projects={allProjects} distributionUsers={distributionUsers} />
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
                distributionUsers={distributionUsers}
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
            <ExportButton items={items} projects={allProjects} distributionUsers={distributionUsers} />
          </div>
        )}
      </main>
    </div>
  );
}
