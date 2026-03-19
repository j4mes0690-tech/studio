'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { SiteDiaryEntry, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, BookOpen, LayoutGrid, List, ShieldCheck, Filter, Calendar, BarChart3, X, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams, useRouter } from 'next/navigation';
import { NewDiaryEntry } from './new-diary-entry';
import { DiaryCard } from './diary-card';
import { DiaryTable } from './diary-table';
import { SiteDiaryReports } from './reports-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SiteDiaryContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const [isCompact, setIsCompact] = useState(false);

  // Filters from URL
  const projectFilter = searchParams.get('project') || 'all';
  const fromFilter = searchParams.get('from') || '';
  const toFilter = searchParams.get('to') || '';

  // Load persistence for view mode
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_site_diary');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_site_diary', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const entriesQuery = useMemoFirebase(() => (db ? query(collection(db, 'site-diary'), orderBy('date', 'desc')) : null), [db]);
  const { data: allEntries, isLoading: entriesLoading } = useCollection<SiteDiaryEntry>(entriesQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  // Security & Visibility
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredEntries = useMemo(() => {
    if (!allEntries) return [];
    const results = allEntries.filter(entry => {
      const isAuthorised = allowedProjectIds.includes(entry.projectId);
      const matchesProject = projectFilter === 'all' || entry.projectId === projectFilter;
      
      let matchesDate = true;
      if (fromFilter) {
        matchesDate = matchesDate && entry.date >= fromFilter;
      }
      if (toFilter) {
        matchesDate = matchesDate && entry.date <= toFilter;
      }

      return isAuthorised && matchesProject && matchesDate;
    });

    // If date filters are set, sort chronologically (Ascending) for easier sequential review
    // Otherwise, keep the default "newest first" (Descending) order
    if (fromFilter || toFilter) {
        return results.sort((a, b) => a.date.localeCompare(b.date));
    }
    
    // Explicitly sort descending if no date filters are present
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }, [allEntries, allowedProjectIds, projectFilter, fromFilter, toFilter]);

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/site-diary');
  };

  if (entriesLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;
  const hasActiveFilters = projectFilter !== 'all' || fromFilter || toFilter;

  return (
    <main className="flex-1 flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Site Diary
          </h2>
          <p className="text-sm text-muted-foreground">Daily logs of site activities, labour resources, and weather conditions.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1 ml-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SiteDiaryReports 
            entries={allEntries || []} 
            projects={allProjects || []} 
            subContractors={allSubContractors || []}
            initialProjectId={projectFilter === 'all' ? null : projectFilter}
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleView}>
                  {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Switch to {isCompact ? 'Card' : 'Table'} View</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NewDiaryEntry 
            projects={allowedProjects} 
            subContractors={allSubContractors || []}
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/20 border-none shadow-none">
        <CardContent className="p-2 px-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5 ml-1">
                <Building2 className="h-2.5 w-2.5" /> Project
              </Label>
              <Select value={projectFilter} onValueChange={(v) => updateFilters({ project: v })}>
                <SelectTrigger className="bg-background h-9 text-xs">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-auto flex gap-2 flex-1 min-w-[280px]">
                <div className="flex-1 space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5 ml-1">
                        <Calendar className="h-2.5 w-2.5" /> From
                    </Label>
                    <Input 
                        type="date" 
                        value={fromFilter} 
                        onChange={(e) => updateFilters({ from: e.target.value })} 
                        className="bg-background h-9 text-xs"
                    />
                </div>

                <div className="flex-1 space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5 ml-1">
                        <Calendar className="h-2.5 w-2.5" /> To
                    </Label>
                    <Input 
                        type="date" 
                        value={toFilter} 
                        onChange={(e) => updateFilters({ to: e.target.value })} 
                        className="bg-background h-9 text-xs"
                    />
                </div>
            </div>

            {hasActiveFilters && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="h-9 px-2 text-muted-foreground hover:text-destructive gap-1.5 font-bold text-[10px] uppercase tracking-tight"
                >
                    <X className="h-3.5 w-3.5" /> Clear
                </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex-1">
        {filteredEntries.length > 0 ? (
          isCompact ? (
            <DiaryTable 
              entries={filteredEntries} 
              projects={allowedProjects}
              subContractors={allSubContractors || []}
              currentUser={profile}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {filteredEntries.map(entry => (
                    <DiaryCard 
                        key={entry.id} 
                        entry={entry} 
                        project={allProjects?.find(p => p.id === entry.projectId)}
                        projects={allowedProjects}
                        subContractors={allSubContractors || []}
                        currentUser={profile}
                    />
                ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No diary entries found</p>
            <p className="text-sm">Adjust your filters or record a daily activity to build your site audit trail.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SiteDiaryPage() {
  return (
    <div className="flex flex-col w-full min-h-svh">
      <Header title="Site Diary" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <SiteDiaryContent />
      </Suspense>
    </div>
  );
}
