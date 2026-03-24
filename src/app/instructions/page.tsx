'use client';

import { Header } from '@/components/layout/header';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';
import { InstructionTable } from './instruction-table';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { Instruction, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    const saved = localStorage.getItem('sitecommand_view_instructions');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_instructions', String(newVal));
  };

  // Fetch profile for permission check
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Fetch static lookups
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: distributionUsers, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

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

  // Visibility logic for projects
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  // STABLE QUERY: Fetch all by date to avoid composite index requirements
  const instructionsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'instructions'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allInstructions, isLoading: instructionsLoading } = useCollection<Instruction>(instructionsQuery);

  // CLIENT-SIDE FILTERING (Security & Selection)
  const filteredInstructions = useMemo(() => {
    if (!allInstructions || !profile) return [];
    
    const email = profile.email.toLowerCase().trim();
    const subId = profile.subContractorId;
    const subEmail = subContractors?.find(s => s.id === subId)?.email.toLowerCase().trim();
    const hasFullVisibility = !!profile.permissions?.hasFullVisibility;

    return allInstructions.filter(inst => {
        const isProjectAllowed = allowedProjectIds.includes(inst.projectId);
        if (!isProjectAllowed) return false;

        if (hasFullVisibility || profile.userType === 'internal') return true;

        // Partners only see instructions sent to them or their company email
        const recipients = inst.recipients?.map(e => e.toLowerCase().trim()) || [];
        return recipients.includes(email) || (subEmail ? recipients.includes(subEmail) : false);
    }).filter(inst => projectId ? inst.projectId === projectId : true);
  }, [allInstructions, allowedProjectIds, projectId, profile, subContractors]);

  const isLoading = usersLoading || projectsLoading || instructionsLoading || profileLoading || subsLoading;

  if (isLoading && !allInstructions) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">
                Instruction Log
            </h2>
            {profile?.permissions?.hasFullVisibility && (
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

            <NewInstruction 
              projects={allowedProjects} 
              allInstructions={allInstructions || []}
              subContractors={subContractors || []}
            />
          </div>
        </div>
        <NoticeFilters projects={allowedProjects} />
        
        {filteredInstructions.length > 0 ? (
          isCompact ? (
            <InstructionTable 
              items={filteredInstructions}
              projects={allProjects || []}
              distributionUsers={distributionUsers || []}
              subContractors={subContractors || []}
            />
          ) : (
            <div className="grid gap-4 md:gap-6">
              {filteredInstructions.map((instruction) => (
                <InstructionCard
                  key={instruction.id}
                  instruction={instruction}
                  projects={allowedProjects}
                  distributionUsers={distributionUsers || []}
                  subContractors={subContractors || []}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
            <p className="text-lg font-semibold">No records found</p>
            <p className="text-sm">You only see instructions for projects you are assigned to.</p>
          </div>
        )}

        {filteredInstructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={filteredInstructions} projects={allowedProjects} />
          </div>
        )}
      </main>
  );
}

function NoticeFilters({ projects }: { projects: Project[] }) {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('project') || 'all';
    
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full sm:w-auto">
                <Select
                    value={projectId}
                    onValueChange={(val) => {
                        const params = new URLSearchParams(window.location.search);
                        if (val === 'all') params.delete('project');
                        else params.set('project', val);
                        window.history.pushState(null, '', `?${params.toString()}`);
                    }}
                >
                    <SelectTrigger><SelectValue placeholder="Filter by project..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

export default function InstructionsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Instructions" />
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
