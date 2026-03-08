'use client';

import { Header } from '@/components/layout/header';
import { SnaggingItemCard } from './snagging-card';
import { NewSnaggingItem } from './new-snagging-item';
import { SnaggingFilters } from './snagging-filters';
import { SnaggingTable } from './snagging-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { SnaggingItem, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function SnaggingContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;
  const [isCompact, setIsCompact] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_snagging');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_snagging', String(newVal));
  };

  // Profile check
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Lookups
  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  // STABLE QUERY: Fetch all by date to avoid composite index requirements
  const snaggingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'snagging-items'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allItems, isLoading: snaggingLoading } = useCollection<SnaggingItem>(snaggingQuery);

  // SECURITY & PROJECT FILTER (Client-side)
  const filteredItems = useMemo(() => {
    if (!allItems || !profile || !allProjects) return [];
    
    const email = profile.email.toLowerCase().trim();
    const hasFullVisibility = !!profile.permissions?.hasFullVisibility;

    const allowedProjectIds = allProjects
        .filter(p => {
            if (hasFullVisibility) return true;
            const assignments = p.assignedUsers || [];
            return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
        })
        .map(p => p.id);

    return allItems.filter(item => {
        const isAllowed = allowedProjectIds.includes(item.projectId);
        const matchesFilter = projectId ? item.projectId === projectId : true;
        return isAllowed && matchesFilter;
    });
  }, [allItems, profile, allProjects, projectId]);

  const isLoading = projectsLoading || snaggingLoading || subsLoading || profileLoading;

  if (isLoading && !allItems) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <h2 className="text-2xl font-bold tracking-tight">Snagging Log</h2>
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
                    onClick={toggleView}
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
            
            <NewSnaggingItem projects={allowedProjects} subContractors={subContractors || []} />
          </div>
        </div>
        
        <SnaggingFilters projects={allowedProjects} />

        {filteredItems.length > 0 ? (
          isCompact ? (
            <SnaggingTable 
              items={filteredItems}
              projects={allProjects || []}
              subContractors={subContractors || []}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {filteredItems.map((item) => (
                <SnaggingItemCard
                  key={item.id}
                  item={item}
                  projects={allProjects || []}
                  subContractors={subContractors || []}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">No records found</p>
            <p className="text-sm">You only see snagging lists for projects you are explicitly assigned to.</p>
          </div>
        )}
      </main>
  );
}

export default function SnaggingPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Snagging Lists" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <SnaggingContent />
      </Suspense>
    </div>
  );
}
