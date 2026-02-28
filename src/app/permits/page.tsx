
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { Permit, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, FileCheck, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PermitFilters } from './permit-filters';
import { PermitCard } from './permit-card';
import { PermitTable } from './permit-table';
import { NewPermitDialog } from './new-permit';
import { useSearchParams } from 'next/navigation';

function PermitsContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const [isCompact, setIsCompact] = useState(false);

  // Filters
  const projectFilter = searchParams.get('project') || 'all';
  const typeFilter = searchParams.get('type') || 'all';
  const statusFilter = searchParams.get('status') || 'all';

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_permits');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_permits', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const permitsQuery = useMemoFirebase(() => (db ? query(collection(db, 'permits'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allPermits, isLoading: permitsLoading } = useCollection<Permit>(permitsQuery);

  // Security & Filtering
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredPermits = useMemo(() => {
    if (!allPermits) return [];
    return allPermits.filter(permit => {
      const isAuthorised = allowedProjectIds.includes(permit.projectId);
      const matchesProject = projectFilter === 'all' || permit.projectId === projectFilter;
      const matchesType = typeFilter === 'all' || permit.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || permit.status === statusFilter;
      return isAuthorised && matchesProject && matchesType && matchesStatus;
    });
  }, [allPermits, allowedProjectIds, projectFilter, typeFilter, statusFilter]);

  if (permitsLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  return (
    <div className="flex flex-col w-full gap-8 p-4 md:p-8 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <FileCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Permits to Work</h2>
          </div>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1 ml-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleView} className="h-10 w-10">
                  {isCompact ? <LayoutGrid className="h-5 w-5" /> : <List className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Switch to {isCompact ? 'Card' : 'Compact'} View</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NewPermitDialog 
            projects={allowedProjects} 
            subContractors={allSubContractors || []} 
            allPermits={allPermits || []}
            currentUser={profile}
          />
        </div>
      </div>

      <PermitFilters projects={allowedProjects} />

      <div className="min-h-[400px]">
        {filteredPermits.length > 0 ? (
          isCompact ? (
            <PermitTable 
              permits={filteredPermits} 
              projects={allowedProjects} 
              subContractors={allSubContractors || []}
              allPermits={allPermits || []}
              currentUser={profile}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredPermits.map(permit => (
                    <PermitCard 
                        key={permit.id} 
                        permit={permit} 
                        project={allProjects?.find(p => p.id === permit.projectId)}
                        subContractor={allSubContractors?.find(s => s.id === permit.contractorId)}
                        projects={allowedProjects}
                        subContractors={allSubContractors || []}
                        allPermits={allPermits || []}
                        currentUser={profile}
                    />
                ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground/40">
            <FileCheck className="h-20 w-20 mb-6 opacity-20" />
            <p className="text-xl font-bold">No permits found</p>
            <p className="text-sm max-w-xs text-center mt-1">Issue a high-risk activity permit to start tracking site safety.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PermitsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Permits to Work" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <PermitsContent />
      </Suspense>
    </div>
  );
}
