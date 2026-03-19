'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { SubContractOrder, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, FileSignature, LayoutGrid, List, ShieldCheck, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NewSubContractOrderDialog } from './new-order';
import { OrderCard } from './order-card';
import { OrderTable } from './order-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ExportButtons } from './export-buttons';

function SubContractOrdersContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_subcontract_orders');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_subcontract_orders', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const ordersQuery = useMemoFirebase(() => (db ? query(collection(db, 'subcontract-orders'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allOrders, isLoading: ordersLoading } = useCollection<SubContractOrder>(ordersQuery);

  // Security & Filtering
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(order => {
      const isAuthorised = allowedProjectIds.includes(order.projectId);
      const matchesProject = projectFilter === 'all' || order.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return isAuthorised && matchesProject && matchesStatus;
    });
  }, [allOrders, allowedProjectIds, projectFilter, statusFilter]);

  const currentProject = useMemo(() => allowedProjects.find(p => p.id === projectFilter), [allowedProjects, projectFilter]);

  if (ordersLoading || !profile) {
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
            <FileSignature className="h-6 w-6 text-primary" />
            Sub Contract Orders
          </h2>
          <p className="text-sm text-muted-foreground">Track agreement lifecycles from drafting to formal execution.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1 ml-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filteredOrders.length > 0 && (
            <ExportButtons 
              items={filteredOrders} 
              project={currentProject} 
            />
          )}

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

          <NewSubContractOrderDialog 
            projects={allowedProjects} 
            subContractors={allSubContractors || []} 
            allOrders={allOrders || []}
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/30 border-none shadow-none">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Log:
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[250px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
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
              <SelectItem value="pending-approval">Awaiting Approval</SelectItem>
              <SelectItem value="docusign">On DocuSign</SelectItem>
              <SelectItem value="completed">Signed & Complete</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredOrders.length > 0 ? (
          isCompact ? (
            <OrderTable 
              orders={filteredOrders} 
              projects={allowedProjects} 
              subContractors={allSubContractors || []}
            />
          ) : (
            filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                project={allProjects?.find(p => p.id === order.projectId)}
                projects={allowedProjects}
                subContractors={allSubContractors || []}
                currentUser={profile}
              />
            ))
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No agreements tracked</p>
            <p className="text-sm">Log a new subcontractor order to begin milestone tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubContractOrdersPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Sub Contract Orders" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <SubContractOrdersContent />
      </Suspense>
    </div>
  );
}
