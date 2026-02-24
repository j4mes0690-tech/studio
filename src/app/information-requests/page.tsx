
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
import { Loader2, LayoutGrid, List, ShieldCheck } from 'lucide-react';
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

  // Fetch lookups
  const projectsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const usersQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // STABLE QUERY: Listen to the entire collection (or URL filter) persistently.
  const itemsQuery = useMemo(() => {
    if (!db) return null;
    const base = collection(db, 'information-requests');
    
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }

    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: allItems, isLoading: itemsLoading } = useCollection<InformationRequest>(itemsQuery);

  // SECURITY FILTER (Client-side)
  const filteredItems = useMemo(() => {
    if (!allItems || !currentUser || !allProjects) return [];
    
    const email = currentUser.email.toLowerCase().trim();
    const hasFullVisibility = !!currentUser.permissions?.hasFullVisibility;

    const allowedProjectIds = allProjects
        .filter(p => {
            if (hasFullVisibility) return true;
            const assignments = p.assignedUsers || [];
            return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
        })
        .map(p => p.id);

    return allItems.filter(item => allowedProjectIds.includes(item.projectId));
  }, [allItems, currentUser, allProjects]);

  // Sort for display (Active/Open status first)
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredItems]);

  const loading = usersLoading || projectsLoading || itemsLoading || profileLoading;

  if (loading && !allItems) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!currentUser && !profileLoading) {
    return (
        <div className="text-center py-12 space-y-4">
            <p className="text-lg font-semibold">Profile Required</p>
            <p>Access to documentation requires an internal profile for: <strong>{firebaseUser?.email}</strong></p>
        </div>
    );
  }

  const hasFullVisibility = !!currentUser?.permissions?.hasFullVisibility;
  const allowedProjects = allProjects?.filter(p => {
      if (hasFullVisibility) return true;
      const email = currentUser?.email.toLowerCase().trim();
      return (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email);
  }) || [];

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className='flex flex-col gap-1'>
            <h2 className="text-2xl font-bold tracking-tight">
                Information Request Log
            </h2>
            {hasFullVisibility && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest">
                    <ShieldCheck className="h-3 w-3" />
                    Administrative Visibility Active
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setIsCompact(!isCompact)}
                    className="flex"
                  >
                    {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {isCompact ? 'Card' : 'Compact'} View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {currentUser && (
              <NewInformationRequest 
                projects={allowedProjects} 
                distributionUsers={distributionUsers || []} 
                currentUser={currentUser}
              />
            )}
          </div>
        </div>
        
        <InformationRequestFilters projects={allowedProjects} />

        {sortedItems.length > 0 ? (
          isCompact ? (
            <InformationRequestTable 
              items={sortedItems}
              projects={allProjects || []}
              distributionUsers={distributionUsers || []}
              currentUser={currentUser!}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {sortedItems.map((item) => (
                <InformationRequestCard
                  key={item.id}
                  item={item}
                  projects={allProjects || []}
                  distributionUsers={distributionUsers || []}
                  currentUser={currentUser!}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">No records found</p>
            <p className="text-sm">
                {hasFullVisibility 
                    ? "No RFIs exist in the system yet." 
                    : "You only have access to RFIs for projects you are explicitly assigned to."}
            </p>
          </div>
        )}

        {sortedItems.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={sortedItems} projects={allProjects || []} distributionUsers={distributionUsers || []} />
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
