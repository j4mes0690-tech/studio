'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { PurchaseOrder, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Loader2, ShoppingCart, Filter, LayoutGrid, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NewOrderDialog } from './new-order';
import { OrderCard } from './order-card';
import { OrderTable } from './order-table';
import { ExportButton } from './export-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function MaterialsOrdersContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCompact, setIsCompact] = useState(false);

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_materials_orders');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_materials_orders', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);
  
  const allSuppliers = useMemo(() => {
    return (allSubContractors || []).filter(s => !!s.isSupplier);
  }, [allSubContractors]);

  const ordersQuery = useMemoFirebase(() => (db ? query(collection(db, 'purchase-orders'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allOrders, isLoading: ordersLoading } = useCollection<PurchaseOrder>(ordersQuery);

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
      const matchesFilter = projectFilter === 'all' || order.projectId === projectFilter;
      return isAuthorised && matchesFilter;
    });
  }, [allOrders, allowedProjectIds, projectFilter]);

  if (ordersLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Purchase Orders
          </h2>
          <p className="text-sm text-muted-foreground">Manage material procurement and supplier distributions.</p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={toggleView} className="h-10 w-10">
                  {isCompact ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Switch to {isCompact ? 'Card' : 'Compact'} View</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {filteredOrders.length > 0 && (
            <ExportButton orders={filteredOrders} projects={allowedProjects} />
          )}

          <NewOrderDialog 
            projects={allowedProjects} 
            suppliers={allSuppliers} 
            allOrders={allOrders || []}
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
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[250px] bg-background">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Authorised Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
              suppliers={allSuppliers}
              allOrders={allOrders || []}
              currentUser={profile}
            />
          ) : (
            filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                project={allProjects?.find(p => p.id === order.projectId)}
                supplier={allSuppliers?.find(s => s.id === order.supplierId)}
                projects={allowedProjects}
                suppliers={allSuppliers}
                allOrders={allOrders || []}
                currentUser={profile}
              />
            ))
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/10">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">No purchase orders found</p>
            <p className="text-sm text-muted-foreground">Create a new order to start tracking material procurement.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MaterialsOrdersPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Materials Orders" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <MaterialsOrdersContent />
      </Suspense>
    </div>
  );
}
