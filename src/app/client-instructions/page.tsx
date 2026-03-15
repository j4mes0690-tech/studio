'use client';

import { Header } from '@/components/layout/header';
import { ClientInstructionCard } from './instruction-card';
import { NewClientInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { InstructionTable } from './instruction-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { ClientInstruction, Project, DistributionUser, Instruction, InformationRequest } from '@/lib/types';
import { Loader2, ShieldCheck, LayoutGrid, List } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function InstructionsContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const projectId = searchParams.get('project') || undefined;
  
  const [isCompact, setIsCompact] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_client_instructions');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_client_instructions', String(newVal));
  };

  // Fetch profile for permission check
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Fetch static lookups
  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  // REFERENCES DATA: Fetch site instructions and RFIs to calculate sequential references in Accept Workspace
  const siteInstructionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'instructions');
  }, [db]);
  const { data: allSiteInstructions } = useCollection<Instruction>(siteInstructionsQuery);

  const rfisQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'information-requests');
  }, [db]);
  const { data: allRfis } = useCollection<InformationRequest>(rfisQuery);

  // STABLE QUERY: Fetch all by date to avoid composite index requirements
  const instructionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'client-instructions'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allInstructions, isLoading: instructionsLoading } = useCollection<ClientInstruction>(instructionsQuery);

  // SECURITY & VISIBILITY & FILTERING (Client-side)
  const filteredInstructions = useMemo(() => {
    if (!allInstructions) return [];
    if (!profile || !allProjects) return allInstructions;

    const email = profile.email.toLowerCase().trim();
    const hasFullVisibility = !!profile.permissions?.hasFullVisibility;

    const allowedProjectIds = allProjects
        .filter(p => {
            if (hasFullVisibility) return true;
            const assignments = p.assignedUsers || [];
            return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
        })
        .map(p => p.id);

    return allInstructions.filter(inst => {
        const isAllowed = allowedProjectIds.includes(inst.projectId);
        const matchesFilter = projectId ? inst.projectId === projectId : true;
        return isAllowed && matchesFilter;
    });
  }, [allInstructions, profile, allProjects, projectId]);

  // Sort for display (Priority sorting: Attention Required first, then Open status, then Newest)
  const sortedInstructions = useMemo(() => {
    if (!filteredInstructions || !profile) return [];
    const email = profile.email.toLowerCase().trim();

    const isAttentionRequired = (ci: ClientInstruction) => {
        if (ci.status !== 'open') return false;
        if (ci.dismissedBy?.includes(email)) return false;
        return (ci.recipients || []).some(e => e.toLowerCase().trim() === email);
    };

    return [...filteredInstructions].sort((a, b) => {
        // 1. Attention Required Priority
        const aReq = isAttentionRequired(a);
        const bReq = isAttentionRequired(b);
        if (aReq && !bReq) return -1;
        if (!aReq && bReq) return 1;

        // 2. Status Priority
        if (a.status !== b.status) {
            return a.status === 'open' ? -1 : 1;
        }

        // 3. Newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredInstructions, profile]);

  const isLoading = (projectsLoading || instructionsLoading || profileLoading) && !allInstructions;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!profile && !profileLoading) {
    return (
        <div className="text-center py-12 space-y-4">
            <p className="text-lg font-semibold">Profile Required</p>
            <p>Access to client documentation requires an internal profile for: <strong>{sessionUser?.email}</strong></p>
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
            <h2 className="text-2xl font-bold tracking-tight">
              Client Instruction Log
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

            <NewClientInstruction 
              projects={allowedProjects} 
              allInstructions={allInstructions || []}
            />
          </div>
        </div>
        <InstructionFilters projects={allowedProjects} />
        
        {sortedInstructions.length > 0 ? (
          isCompact ? (
            <InstructionTable 
              items={sortedInstructions}
              projects={allProjects || []}
              distributionUsers={[]} 
              currentUser={profile!}
              allSiteInstructions={allSiteInstructions || []}
              allRfis={allRfis || []}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {sortedInstructions.map((instruction) => (
                <ClientInstructionCard
                  key={instruction.id}
                  instruction={instruction}
                  projects={allProjects || []}
                  currentUser={profile!}
                  allSiteInstructions={allSiteInstructions || []}
                  allRfis={allRfis || []}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
            <p className="text-lg font-semibold">No directives recorded</p>
            <p className="text-sm">Log requests directly from the client to ensure clear implementation.</p>
          </div>
        )}

        {sortedInstructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={sortedInstructions} projects={allProjects || []} />
          </div>
        )}
      </main>
  );
}

export default function ClientInstructionsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Client Instructions" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <InstructionsContent />
      </Suspense>
    </div>
  );
}
