'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, Suspense, useEffect } from 'react';
import type { HolidayRequest, DistributionUser, Project } from '@/lib/types';
import { Loader2, Sun, ShieldCheck, Filter, LayoutGrid, List, Plane, User, Clock, CheckCircle2, History, Calculator, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams } from 'next/navigation';
import { HolidayRequestCard } from './request-card';
import { NewHolidayRequest } from './new-request';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

function HolidayContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();
  const [isCompact, setIsCompact] = useState(false);
  
  const statusFilter = searchParams.get('status') || 'all';
  const userFilter = searchParams.get('user') || 'all';

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_holidays');
    if (saved !== null) setIsCompact(saved === 'true');
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_view_holidays', String(newVal));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  const requestsQuery = useMemoFirebase(() => (db ? query(collection(db, 'holiday-requests'), orderBy('startDate', 'desc')) : null), [db]);
  const { data: allRequests, isLoading: requestsLoading } = useCollection<HolidayRequest>(requestsQuery);

  // Balance Calculations
  const balance = useMemo(() => {
    if (!profile || !allRequests) return { entitlement: 0, used: 0, pending: 0, remaining: 0, percentage: 0 };
    
    const email = profile.email.toLowerCase();
    const currentYear = new Date().getFullYear();
    
    const myRequests = allRequests.filter(r => r.userEmail.toLowerCase() === email);
    
    // Sum only 'holiday' type for entitlement calculation in the current calendar year
    const approvedHolidayDays = myRequests.filter(r => {
        if (r.status !== 'approved' || r.type !== 'holiday') return false;
        const start = new Date(r.startDate);
        return start.getFullYear() === currentYear;
    }).reduce((sum, r) => sum + r.totalDays, 0);

    const pendingHolidayDays = myRequests.filter(r => {
        if (r.status !== 'pending' || r.type !== 'holiday') return false;
        const start = new Date(r.startDate);
        return start.getFullYear() === currentYear;
    }).reduce((sum, r) => sum + r.totalDays, 0);

    const entitlement = profile.holidayEntitlement || 0;
    const remaining = Math.max(0, entitlement - approvedHolidayDays);
    const percentage = entitlement > 0 ? (approvedHolidayDays / entitlement) * 100 : 0;

    return {
        entitlement,
        used: approvedHolidayDays,
        pending: pendingHolidayDays,
        remaining,
        percentage
    };
  }, [allRequests, profile]);

  // Security Logic
  const canApproveHolidays = !!profile?.permissions?.canApproveHolidays || !!profile?.permissions?.hasFullVisibility;

  const filteredRequests = useMemo(() => {
    if (!allRequests || !profile) return [];
    
    const email = profile.email.toLowerCase().trim();
    const isAdmin = !!profile.permissions?.hasFullVisibility;
    const canGlobalApprove = !!profile.permissions?.canApproveHolidays;

    // Filter by visibility first
    let base = allRequests.filter(r => {
        const isOwn = r.userEmail.toLowerCase().trim() === email;
        if (isOwn) return true;
        
        // If admin or global approver, see others
        if (isAdmin || canGlobalApprove) return true;

        // If I am the assigned line manager for this user, I can see it
        const targetUser = allUsers?.find(u => u.email.toLowerCase().trim() === r.userEmail.toLowerCase().trim());
        if (targetUser?.lineManagerEmail?.toLowerCase().trim() === email) return true;

        return false;
    });

    // Apply UI Filters
    return base.filter(r => {
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchesUser = userFilter === 'all' || r.userEmail === userFilter;
        return matchesStatus && matchesUser;
    });
  }, [allRequests, profile, allUsers, statusFilter, userFilter]);

  if (requestsLoading || !profile) {
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
            <Sun className="h-6 w-6 text-primary" />
            Holiday & Leave Booking
          </h2>
          <p className="text-sm text-muted-foreground">Manage time off requests and track site availability.</p>
          {canApproveHolidays && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Approval Access
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
              <TooltipContent><p>Switch to {isCompact ? 'Grid' : 'Table'} View</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <NewHolidayRequest currentUser={profile} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2 p-4">
                  <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Yearly Allowance</p>
                      <Calculator className="h-3 w-3 text-primary opacity-40" />
                  </div>
                  <CardTitle className="text-2xl font-black">{balance.entitlement} Days</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                      <Progress value={balance.percentage} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground font-bold">Current Calendar Year</p>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-green-100 p-2 rounded-lg text-green-600"><CheckCircle2 className="h-5 w-5" /></div>
                  <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Used Holidays</p>
                      <p className="text-xl font-bold text-green-700">{balance.used} Days Approved</p>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Clock className="h-5 w-5" /></div>
                  <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pending Approval</p>
                      <p className="text-xl font-bold text-amber-700">{balance.pending} Days Requested</p>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary"><TrendingUp className="h-5 w-5" /></div>
                  <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Remaining Balance</p>
                      <p className="text-xl font-bold text-primary">{balance.remaining} Days Left</p>
                  </div>
              </CardContent>
          </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Log:
          </div>
          <Select value={statusFilter} onValueChange={(v) => {
              const p = new URLSearchParams(window.location.search);
              if (v === 'all') p.delete('status'); else p.set('status', v);
              window.history.pushState(null, '', `?${p.toString()}`);
          }}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {canApproveHolidays && (
            <Select value={userFilter} onValueChange={(v) => {
                const p = new URLSearchParams(window.location.search);
                if (v === 'all') p.delete('user'); else p.set('user', v);
                window.history.pushState(null, '', `?${p.toString()}`);
            }}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {allUsers?.map(u => <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>)}
                </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredRequests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRequests.map(request => {
                  const targetUser = allUsers?.find(u => u.email.toLowerCase().trim() === request.userEmail.toLowerCase().trim());
                  const isManager = targetUser?.lineManagerEmail?.toLowerCase().trim() === profile.email.toLowerCase().trim();
                  const canIApprove = canApproveHolidays || isManager;

                  return (
                    <HolidayRequestCard 
                        key={request.id} 
                        request={request} 
                        currentUser={profile}
                        canApprove={canIApprove}
                    />
                  );
              })}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <Plane className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No leave requests found</p>
            <p className="text-sm">Submit a new request to schedule your time off.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HolidayPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Holiday Booking" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <HolidayContent />
      </Suspense>
    </div>
  );
}
