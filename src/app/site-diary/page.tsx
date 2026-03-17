
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { SiteDiaryEntry, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, BookOpen, LayoutGrid, List, ShieldCheck, Filter, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams } from 'next/navigation';
import { NewDiaryEntry } from './new-diary-entry';
import { DiaryCard } from './diary-card';
import { DiaryTable } from './diary-table';

function SiteDiaryContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const [isCompact, setIsCompact] = useState(false);

  // Filters
  const projectFilter = searchParams.get('project') || 'all';

  // Load persistence
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
    return allEntries.filter(entry => {
      const isAuthorised = allowedProjectIds.includes(entry.projectId);
      const matchesProject = projectFilter === 'all' || entry.projectId === projectFilter;
      return isAuthorised && matchesProject;
    });
  }, [allEntries, allowedProjectIds, projectFilter]);

  if (entriesLoading || !profile) {
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
            <BookOpen className="h-6 w-6 text-primary" />
            Site Diary
          </h2>
          <p className="text-sm text-muted-foreground">Daily logs of site activities, labor resources, and weather conditions.</p>
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

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Log:
          </div>
          <Select value={projectFilter} onValueChange={(v) => {
              const p = new URLSearchParams(window.location.search);
              if (v === 'all') p.delete('project'); else p.set('project', v);
              window.history.pushState(null, '', `?${p.toString()}`);
          }}>
            <SelectTrigger className="w-full sm:w-[250px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredEntries.length > 0 ? (
          isCompact ? (
            <DiaryTable 
              entries={filteredEntries} 
              projects={allowedProjects}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntries.map(entry => (
                    <DiaryCard 
                        key={entry.id} 
                        entry={entry} 
                        project={allProjects?.find(p => p.id === entry.projectId)}
                    />
                ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No diary entries found</p>
            <p className="text-sm">Record daily activities to build a comprehensive site audit trail.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteDiaryPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Site Diary" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <SiteDiaryContent />
      </Suspense>
    </div>
  );
}
