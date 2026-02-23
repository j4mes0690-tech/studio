'use client';

import { Header } from '@/components/layout/header';
import { InformationRequestCard } from './information-request-card';
import { NewInformationRequest } from './new-information-request';
import { InformationRequestFilters } from './information-request-filters';
import { ExportButton } from './export-button';
import { InformationRequestTable } from './information-request-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, Suspense } from 'react';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function InfoRequestsContent() {
  const { user: firebaseUser } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;
  
  const [isCompact, setIsCompact] = useState(false);

  // Fetch current user profile
  const currentUserRef = useMemo(() => {
    if (!db || !firebaseUser?.email) return null;
    return doc(db, 'users', firebaseUser.email.toLowerCase().trim());
  }, [db, firebaseUser?.email]);
  const { data: currentUser, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  // Fetch distribution users from Firestore for assignment selectors
  const usersQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // Fetch Projects from Firestore
  const projectsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  // Filter allowed projects based on strict assignment rules
  const allowedProjects = useMemo(() => {
    if (!allProjects || !currentUser) return [];
    
    // Project management admins see everything
    if (currentUser.permissions?.canManageProjects) return allProjects;

    // Standard users only see projects they are explicitly assigned to
    const email = currentUser.email.toLowerCase().trim();
    return allProjects.filter(p => p.assignedUsers?.includes(email));
  }, [allProjects, currentUser]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  // Fetch Information Requests
  const itemsQuery = useMemo(() => {
    if (!db) return null;
    const base = collection(db, 'information-requests');
    
    // If a specific project is requested via URL, we must validate access first
    if (projectId) {
      if (!allowedProjectIds.includes(projectId)) {
          // If the user isn't assigned to this project, we return null to prevent data fetch
          return null;
      }
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }

    // Default view: fetch all RFIs (we will filter client-side against allowedProjectIds)
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId, allowedProjectIds]);

  const { data: allItems, isLoading: itemsLoading } = useCollection<InformationRequest>(itemsQuery);

  // CRITICAL: Final filter to ensure only requests from allowed projects are displayed
  const filteredItems = useMemo(() => {
    if (!allItems) return [];
    return allItems.filter(item => allowedProjectIds.includes(item.projectId));
  }, [allItems, allowedProjectIds]);

  // Client-side sorting: Open requests first, then closed
  const sortedItems = useMemo(() => {
    if (!filteredItems) return [];
    return [...filteredItems].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredItems]);

  const loading = usersLoading || projectsLoading || itemsLoading || profileLoading;

  if (loading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!currentUser) {
    return (
        <div className="text-center py-12 space-y-4">
            <p>Access restricted. Could not find an internal profile for: <strong>{firebaseUser?.email}</strong></p>
            <p className="text-sm text-muted-foreground">Please ensure your email is added to the Distribution List in Settings.</p>
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Information Request Log
          </h2>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setIsCompact(!isCompact)}
                    className="hidden sm:flex"
                  >
                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {isCompact ? 'Card' : 'Compact'} View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <NewInformationRequest 
              projects={allowedProjects || []} 
              distributionUsers={distributionUsers || []} 
              currentUser={currentUser}
            />
          </div>
        </div>
        
        <InformationRequestFilters projects={allowedProjects || []} />

        {sortedItems && sortedItems.length > 0 ? (
          isCompact ? (
            <InformationRequestTable 
              items={sortedItems}
              projects={allowedProjects || []}
              distributionUsers={distributionUsers || []}
              currentUser={currentUser}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {sortedItems.map((item) => (
                <InformationRequestCard
                  key={item.id}
                  item={item}
                  projects={allowedProjects || []}
                  distributionUsers={distributionUsers || []}
                  currentUser={currentUser}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p>No information requests found for your assigned projects.</p>
            <p className="text-sm">Only team members assigned to a project can view its requests.</p>
          </div>
        )}

        {sortedItems && sortedItems.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={sortedItems} projects={allowedProjects || []} distributionUsers={distributionUsers || []} />
          </div>
        )}
      </main>
  );
}

export default function InformationRequestsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Information Requests" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <InfoRequestsContent />
      </Suspense>
    </div>
  );
}
