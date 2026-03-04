'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { Variation, Project, DistributionUser, ClientInstruction, Instruction } from '@/lib/types';
import { Loader2, Calculator, LayoutGrid, List, ShieldCheck, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NewVariationDialog } from './new-variation';
import { VariationCard } from './variation-card';
import { VariationTable } from './variation-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function VariationsContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_variations');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_variations', String(newVal));
  };

  // Data Loading
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const variationsQuery = useMemoFirebase(() => (db ? query(collection(db, 'variations'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allVariations, isLoading: variationsLoading } = useCollection<Variation>(variationsQuery);

  // Fetch instructions for linking references
  const ciQuery = useMemoFirebase(() => (db ? collection(db, 'client-instructions') : null), [db]);
  const { data: clientInstructions } = useCollection<ClientInstruction>(ciQuery);

  const siQuery = useMemoFirebase(() => (db ? collection(db, 'instructions') : null), [db]);
  const { data: siteInstructions } = useCollection<Instruction>(siQuery);

  // Visibility & Filtering
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredVariations = useMemo(() => {
    if (!allVariations) return [];
    return allVariations.filter(v => {
      const isAuthorized = allowedProjectIds.includes(v.projectId);
      const matchesProject = projectFilter === 'all' || v.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return isAuthorized && matchesProject && matchesStatus;
    });
  }, [allVariations, allowedProjectIds, projectFilter, statusFilter]);

  if (variationsLoading || !profile) {
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
            <Calculator className="h-6 w-6 text-primary" />
            Variation Pricing
          </h2>
          <p className="text-sm text-muted-foreground">Track financial changes and link to site directives.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Visibility Active
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

          <NewVariationDialog 
            projects={allowedProjects} 
            allVariations={allVariations || []}
            clientInstructions={clientInstructions || []}
            siteInstructions={siteInstructions || []}
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Variations:
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Authorised Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Any Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Submitted</SelectItem>
              <SelectItem value="agreed">Agreed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredVariations.length > 0 ? (
          isCompact ? (
            <VariationTable 
              variations={filteredVariations} 
              projects={allowedProjects}
              clientInstructions={clientInstructions || []}
              siteInstructions={siteInstructions || []}
              allVariations={allVariations || []}
              currentUser={profile}
            />
          ) : (
            filteredVariations.map(variation => (
              <VariationCard 
                key={variation.id} 
                variation={variation} 
                project={allProjects?.find(p => p.id === variation.projectId)}
                projects={allowedProjects}
                clientInstructions={clientInstructions || []}
                siteInstructions={siteInstructions || []}
                allVariations={allVariations || []}
                currentUser={profile}
              />
            ))
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/10">
            <Calculator className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">No variations recorded</p>
            <p className="text-sm text-muted-foreground">Create a new variation to start tracking project cost changes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VariationsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Variation Pricing" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <VariationsContent />
      </Suspense>
    </div>
  );
}
