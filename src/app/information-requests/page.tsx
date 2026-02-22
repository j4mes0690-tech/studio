'use client';

import { Header } from '@/components/layout/header';
import { InformationRequestCard } from './information-request-card';
import { NewInformationRequest } from './new-information-request';
import { InformationRequestFilters } from './information-request-filters';
import { ExportButton } from './export-button';
import { InformationRequestTable } from './information-request-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function InformationRequestsPage() {
  const { user: firebaseUser } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || undefined;
  
  const [isCompact, setIsCompact] = useState(false);

  // Fetch distribution users from Firestore
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

  // Fetch Information Requests from Firestore (Real-time)
  const itemsQuery = useMemo(() => {
    if (!db) return null;
    const base = collection(db, 'information-requests');
    if (projectId) {
      return query(base, where('projectId', '==', projectId), orderBy('createdAt', 'desc'));
    }
    return query(base, orderBy('createdAt', 'desc'));
  }, [db, projectId]);

  const { data: items, isLoading: itemsLoading } = useCollection<InformationRequest>(itemsQuery);

  // Client-side sorting: Open requests first, then closed
  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => {
      // 1. Sort by status: 'open' items come before 'closed'
      if (a.status !== b.status) {
        return a.status === 'open' ? -1 : 1;
      }
      // 2. Secondary sort: Within the same status, sort by createdAt descending
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  const currentUser = useMemo(() => {
    if (!firebaseUser?.email || !distributionUsers) return null;
    const email = firebaseUser.email.toLowerCase().trim();
    return distributionUsers.find(u => u.email.toLowerCase().trim() === email) || null;
  }, [firebaseUser, distributionUsers]);

  const loading = usersLoading || projectsLoading || itemsLoading;

  if (loading) {
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
              projects={allProjects || []} 
              distributionUsers={distributionUsers || []} 
              currentUser={currentUser}
            />
          </div>
        </div>
        
        <InformationRequestFilters projects={allProjects || []} />

        {sortedItems && sortedItems.length > 0 ? (
          isCompact ? (
            <InformationRequestTable 
              items={sortedItems}
              projects={allProjects || []}
              distributionUsers={distributionUsers || []}
              currentUser={currentUser}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {sortedItems.map((item) => (
                <InformationRequestCard
                  key={item.id}
                  item={item}
                  projects={allProjects || []}
                  distributionUsers={distributionUsers || []}
                  currentUser={currentUser}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p>No information requests found.</p>
            <p className="text-sm">Try adjusting your filters or adding a new item.</p>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={items} projects={allProjects || []} distributionUsers={distributionUsers || []} />
          </div>
        )}
      </main>
    </div>
  );
}
