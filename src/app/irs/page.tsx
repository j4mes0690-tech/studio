
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, writeBatch } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense, useTransition } from 'react';
import type { IRSItem, Project, DistributionUser, SubContractor, InformationRequest } from '@/lib/types';
import { Loader2, CalendarClock, LayoutGrid, List, ShieldCheck, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { IRSCard } from './irs-card';
import { IRSTable } from './irs-table';
import { NewIRSItemDialog } from './new-irs-item';
import { useSearchParams } from 'next/navigation';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';

function IRSContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isCompact, setIsCompact] = useState(false);

  // Filters
  const projectFilter = searchParams.get('project') || 'all';
  const statusFilter = searchParams.get('status') || 'all';

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_irs');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_irs', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const irsQuery = useMemoFirebase(() => (db ? query(collection(db, 'irs-items'), orderBy('requiredByDate', 'asc')) : null), [db]);
  const { data: allIRSItems, isLoading: irsLoading } = useCollection<IRSItem>(irsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const rfiQuery = useMemoFirebase(() => (db ? collection(db, 'information-requests') : null), [db]);
  const { data: allRFIs } = useCollection<InformationRequest>(rfiQuery);

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  // Security & Visibility
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredIRS = useMemo(() => {
    if (!allIRSItems) return [];
    return allIRSItems.filter(item => {
      const isAuthorised = allowedProjectIds.includes(item.projectId);
      const matchesProject = projectFilter === 'all' || item.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return isAuthorised && matchesProject && matchesStatus;
    });
  }, [allIRSItems, allowedProjectIds, projectFilter, statusFilter]);

  // Escalation Logic (Check for overdue items and escalate to RFI)
  const handleEscalateOverdue = () => {
    if (!allIRSItems || !allRFIs || !profile) return;

    startTransition(async () => {
      const batch = writeBatch(db);
      const overdueItems = allIRSItems.filter(item => {
        if (item.status !== 'open') return false;
        const today = startOfDay(new Date());
        const required = startOfDay(parseISO(item.requiredByDate));
        return differenceInDays(required, today) < 0;
      });

      if (overdueItems.length === 0) {
        toast({ title: 'Schedule Compliant', description: 'No overdue items identified.' });
        return;
      }

      let escalationsCount = 0;

      for (const item of overdueItems) {
        const project = allProjects?.find(p => p.id === item.projectId);
        const initials = getProjectInitials(project?.name || 'PRJ');
        
        const existingRefs = allRFIs.map(r => ({ reference: r.reference, projectId: r.projectId }));
        const rfiRef = getNextReference(existingRefs, item.projectId, 'RFI', initials);

        const rfiData: Omit<InformationRequest, 'id'> = {
          reference: rfiRef,
          projectId: item.projectId,
          irsItemId: item.id,
          description: `AUTOMATIC ESCALATION: Required Information "${item.title}" is OVERDUE. Original requirement date: ${new Date(item.requiredByDate).toLocaleDateString()}. Details: ${item.description}`,
          assignedTo: [item.assignedToEmail],
          raisedBy: 'system@sitecommand.internal',
          createdAt: new Date().toISOString(),
          status: 'open',
          messages: [{
            id: `sys-${Date.now()}`,
            sender: 'Compliance Bot',
            senderEmail: 'system@sitecommand.internal',
            message: `This RFI has been automatically generated because the information required per the project schedule (IRS) is now overdue.`,
            createdAt: new Date().toISOString()
          }],
          requiredBy: item.requiredByDate
        };

        const rfiDocRef = await addDoc(collection(db, 'information-requests'), rfiData);
        
        const irsDocRef = doc(db, 'irs-items', item.id);
        batch.update(irsDocRef, { 
          status: 'escalated',
          escalatedRfiId: rfiDocRef.id
        });
        
        escalationsCount++;
      }

      await batch.commit();
      toast({ title: 'Schedule Escalated', description: `Generated ${escalationsCount} automatic RFIs for overdue items.` });
    });
  };

  if (irsLoading || !profile) {
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
            <CalendarClock className="h-6 w-6 text-primary" />
            Information Required Schedule (IRS)
          </h2>
          <p className="text-sm text-muted-foreground">Monitor design deliverables and client choices against project milestones.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1 ml-1">
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

          <Button 
            variant="outline" 
            className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 font-bold" 
            onClick={handleEscalateOverdue}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Escalate Overdue
          </Button>

          <NewIRSItemDialog 
            projects={allowedProjects} 
            users={allUsers || []}
            subContractors={subContractors || []}
            allIRSItems={allIRSItems || []}
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
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => {
              const p = new URLSearchParams(window.location.search);
              if (v === 'all') p.delete('status'); else p.set('status', v);
              window.history.pushState(null, '', `?${p.toString()}`);
          }}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Any Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="provided">Provided</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="escalated">Escalated to RFI</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredIRS.length > 0 ? (
          isCompact ? (
            <IRSTable 
              items={filteredIRS} 
              projects={allowedProjects} 
              users={allUsers || []}
              subContractors={subContractors || []}
              currentUser={profile}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIRS.map(item => (
                    <IRSCard 
                        key={item.id} 
                        item={item} 
                        project={allProjects?.find(p => p.id === item.projectId)}
                        users={allUsers || []}
                        subContractors={subContractors || []}
                        currentUser={profile}
                    />
                ))}
            </div>
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No IRS items found</p>
            <p className="text-sm">Record design requirements to ensure timely delivery of project information.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IRSPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Information Required Schedule" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <IRSContent />
      </Suspense>
    </div>
  );
}
