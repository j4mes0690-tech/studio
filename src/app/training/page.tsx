
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { TrainingRecord, TrainingNeed, DistributionUser } from '@/lib/types';
import { Loader2, GraduationCap, ClipboardList, ShieldCheck, Filter, LayoutGrid, List, Archive, ArchiveRestore, Eye, EyeOff, FileStack } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewTrainingRecord } from './new-training-record';
import { TrainingRecordCard } from './training-record-card';
import { TrainingRecordTable } from './training-record-table';
import { TrainingNeeds } from './training-needs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function TrainingContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [viewType, setViewType] = useState<'card' | 'table'>('card');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_view_training');
    if (saved !== null) setViewType(saved as any);
    const savedArchived = localStorage.getItem('sitecommand_show_archived_training');
    if (savedArchived !== null) setShowArchived(savedArchived === 'true');
  }, []);

  const toggleView = () => {
    const newVal = viewType === 'card' ? 'table' : 'card';
    setViewType(newVal);
    localStorage.setItem('sitecommand_view_training', newVal);
  };

  const handleStatusChange = (val: string) => {
    const isArchive = val === 'archived';
    setShowArchived(isArchive);
    localStorage.setItem('sitecommand_show_archived_training', String(isArchive));
  };

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const usersQuery = useMemoFirebase(() => (db ? collection(db, 'users') : null), [db]);
  const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

  const recordsQuery = useMemoFirebase(() => (db ? query(collection(db, 'training-records'), orderBy('expiryDate', 'asc')) : null), [db]);
  const { data: allRecords, isLoading: recordsLoading } = useCollection<TrainingRecord>(recordsQuery);

  const needsQuery = useMemoFirebase(() => (db ? query(collection(db, 'training-needs'), orderBy('requestedDate', 'desc')) : null), [db]);
  const { data: allNeeds, isLoading: needsLoading } = useCollection<TrainingNeed>(needsQuery);

  // Security Logic
  const canManageTraining = !!profile?.permissions?.canManageTraining || !!profile?.permissions?.hasFullVisibility;

  const filteredRecords = useMemo(() => {
    if (!allRecords || !profile) return [];
    
    // 1. Filter by user visibility
    let base = allRecords;
    if (!canManageTraining) {
        base = allRecords.filter(r => r.userEmail.toLowerCase() === profile.email.toLowerCase());
    }

    // 2. Filter by User Dropdown
    if (userFilter !== 'all') {
        base = base.filter(r => r.userEmail.toLowerCase() === userFilter.toLowerCase());
    }

    // 3. Filter by Archive Status
    return base.filter(r => !!r.archived === showArchived);
  }, [allRecords, profile, canManageTraining, userFilter, showArchived]);

  if (recordsLoading || needsLoading || !profile) {
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
            <GraduationCap className="h-6 w-6 text-primary" />
            Training & Compliance
          </h2>
          <p className="text-sm text-muted-foreground">Monitor staff certifications and identify future training needs.</p>
          {profile.permissions?.hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1 ml-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Compliance Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <div className="flex items-center border rounded-md p-0.5 bg-muted/20">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={toggleView} className="h-9 w-9">
                            {viewType === 'table' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Switch to {viewType === 'table' ? 'Card' : 'Table'} View</p></TooltipContent>
                </Tooltip>
            </div>
          </TooltipProvider>

          <NewTrainingRecord 
            users={allUsers || []} 
            currentUser={profile}
            canManageAll={canManageTraining}
          />
        </div>
      </div>

      <Tabs defaultValue="certificates" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="certificates" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Certificates
          </TabsTrigger>
          <TabsTrigger value="needs" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Required Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="space-y-6 mt-6">
          <Card className="bg-muted/30 border-none shadow-none">
              <CardContent className="p-4 flex flex-wrap gap-6 items-end">
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                        <Filter className="h-2.5 w-2.5" /> Employee Filter
                      </Label>
                      <Select value={userFilter} onValueChange={setUserFilter}>
                          <SelectTrigger className="bg-background h-10">
                              <SelectValue placeholder="All Employees" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Employees</SelectItem>
                              {allUsers?.map(u => (
                                  <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  <div className="space-y-1.5 w-full sm:w-[200px]">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1 flex items-center gap-1.5">
                        <FileStack className="h-2.5 w-2.5" /> Registry Status
                      </Label>
                      <Select value={showArchived ? 'archived' : 'active'} onValueChange={handleStatusChange}>
                          <SelectTrigger className={cn("h-10 font-bold", showArchived ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-background")}>
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="active">Active Registry</SelectItem>
                              <SelectItem value="archived">Historical Archive</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>

                  {showArchived && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 h-10 px-4 uppercase font-black text-[10px] tracking-widest">
                          <Archive className="h-3.5 w-3.5" />
                          Archive Mode
                      </Badge>
                  )}
              </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredRecords.length > 0 ? (
              viewType === 'table' ? (
                <TrainingRecordTable 
                  records={filteredRecords} 
                  users={allUsers || []}
                  canManageAll={canManageTraining}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRecords.map(record => (
                        <TrainingRecordCard 
                          key={record.id} 
                          record={record} 
                          users={allUsers || []}
                          canManageAll={canManageTraining}
                        />
                    ))}
                </div>
              )
            ) : (
              <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/10">
                <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-semibold text-muted-foreground">
                    {showArchived ? 'No archived certificates found.' : 'No active certificates found.'}
                </p>
                <p className="text-sm text-muted-foreground">Add certificates to start tracking compliance.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="needs" className="mt-6">
          <TrainingNeeds 
            needs={allNeeds || []} 
            users={allUsers || []} 
            currentUser={profile}
            canManageAll={canManageTraining}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Training & Compliance" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <TrainingContent />
      </Suspense>
    </div>
  );
}
