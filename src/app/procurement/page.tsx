'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { ProcurementItem, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, ShoppingCart, LayoutGrid, List, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProcurementFilters } from './procurement-filters';
import { ProcurementCard } from './procurement-card';
import { ProcurementTable } from './procurement-table';
import { NewProcurementDialog } from './new-item';

function ProcurementContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_procurement');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_procurement', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const procurementQuery = useMemoFirebase(() => (db ? query(collection(db, 'procurement-items'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allProcurement, isLoading: procLoading } = useCollection<ProcurementItem>(procurementQuery);

  // Security & Filtering
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredItems = useMemo(() => {
    if (!allProcurement) return [];
    return allProcurement.filter(item => {
      const isAuthorised = allowedProjectIds.includes(item.projectId);
      const matchesProject = projectFilter === 'all' || item.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return isAuthorised && matchesProject && matchesStatus;
    });
  }, [allProcurement, allowedProjectIds, projectFilter, statusFilter]);

  if (procLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  return (
    <div className="flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Procurement Schedule
          </h2>
          <p className="text-sm text-muted-foreground">Manage the trade tendering timeline and milestone appointments.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleView}>
                  {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Switch to {isCompact ? 'Card' : 'Compact'} View</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NewProcurementDialog 
            projects={allowedProjects} 
            subContractors={allSubContractors || []} 
            allProcurement={allProcurement || []}
            currentUser={profile}
          />
        </div>
      </div>

      <ProcurementFilters 
        projects={allowedProjects} 
        selectedProjectId={projectFilter} 
        onProjectChange={setProjectFilter}
        selectedStatus={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <div className="grid gap-4">
        {filteredItems.length > 0 ? (
          isCompact ? (
            <ProcurementTable 
              items={filteredItems} 
              projects={allowedProjects} 
              subContractors={allSubContractors || []}
              currentUser={profile}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredItems.map(item => (
                    <ProcurementCard 
                        key={item.id} 
                        item={item} 
                        project={allProjects?.find(p => p.id === item.projectId)}
                        projects={allowedProjects}
                        subContractors={allSubContractors || []}
                        currentUser={profile}
                    />
                ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No procurement items tracked</p>
            <p className="text-sm">Initiate a trade package above to begin monitoring the tendering process.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProcurementPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Procurement Schedule" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <ProcurementContent />
      </Suspense>
    </div>
  );
}
