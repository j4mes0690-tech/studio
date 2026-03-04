'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { PlantOrder, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, Truck, LayoutGrid, List, ShieldCheck, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NewPlantOrderDialog } from './new-order';
import { OrderCard } from './order-card';
import { OrderTable } from './order-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function PlantOrdersContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_plant_orders');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_plant_orders', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  // Filter for Plant Suppliers
  const plantSuppliers = useMemo(() => (allSubContractors || []).filter(s => !!s.isPlantSupplier), [allSubContractors]);

  const ordersQuery = useMemoFirebase(() => (db ? query(collection(db, 'plant-orders'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allOrders, isLoading: ordersLoading } = useCollection<PlantOrder>(ordersQuery);

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
            <Truck className="h-6 w-6 text-primary" />
            Plant Orders
          </h2>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
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

          <NewPlantOrderDialog 
            projects={allowedProjects} 
            subContractors={allSubContractors || []} 
            allOrders={allOrders || []}
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter By:
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
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
              <SelectItem value="scheduled">Committed</SelectItem>
              <SelectItem value="on-hire">Active (On-Hire)</SelectItem>
              <SelectItem value="off-hired">Off-Hired</SelectItem>
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
              currentUser={profile}
            />
          ) : (
            filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                project={allProjects?.find(p => p.id === order.projectId)}
                subContractors={allSubContractors || []}
                projects={allowedProjects}
                allOrders={allOrders || []}
                currentUser={profile}
              />
            ))
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <Truck className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No plant orders found</p>
            <p className="text-sm">Schedule hire equipment to start tracking on-site assets.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlantOrdersPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Plant Orders" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <PlantOrdersContent />
      </Suspense>
    </div>
  );
}
