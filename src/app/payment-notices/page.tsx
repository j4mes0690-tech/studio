
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { useMemo, useState, Suspense } from 'react';
import type { PaymentNotice, Project, DistributionUser, SubContractor, PaymentNoticeStatus } from '@/lib/types';
import { Loader2, Banknote, Building2, Calendar, Filter, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth } from 'date-fns';

function PaymentNoticesContent() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user: sessionUser } = useUser();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  // Period state (default to current month)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));

  // Generate a list of available months (last 6 months and next 3 months)
  const availablePeriods = useMemo(() => {
    const periods = [];
    const base = startOfMonth(new Date());
    for (let i = -6; i <= 3; i++) {
      const d = subMonths(base, -i);
      periods.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy')
      });
    }
    return periods.reverse();
  }, []);

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const noticesQuery = useMemoFirebase(() => (db ? collection(db, 'payment-notices') : null), [db]);
  const { data: allNotices, isLoading: noticesLoading } = useCollection<PaymentNotice>(noticesQuery);

  // Security & Project Filter
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const activeProject = useMemo(() => allowedProjects.find(p => p.id === selectedProjectId), [allowedProjects, selectedProjectId]);

  const projectSubs = useMemo(() => {
    if (!activeProject || !subContractors) return [];
    const assignedIds = activeProject.assignedSubContractors || [];
    return subContractors.filter(s => assignedIds.includes(s.id));
  }, [activeProject, subContractors]);

  // Status calculation logic
  const getStatus = (notice: Partial<PaymentNotice>): PaymentNoticeStatus => {
    if (notice.invoiceUploadedDate) return 'processed';
    if (notice.invoiceReceivedDate) return 'invoiced';
    if (notice.certificateIssuedDate) return 'certified';
    return 'pending';
  };

  const handleUpdateDate = async (subId: string, field: keyof PaymentNotice, value: string | null) => {
    if (!selectedProjectId || !selectedPeriod) return;
    
    // Unique ID per Project, Subcontractor, and Period (Month)
    const docId = `${selectedProjectId}_${subId}_${selectedPeriod}`;
    const existing = allNotices?.find(n => n.id === docId);
    const sub = subContractors?.find(s => s.id === subId);

    const updates: Partial<PaymentNotice> = {
      ...(existing || {}),
      projectId: selectedProjectId,
      period: selectedPeriod,
      subcontractorId: subId,
      subcontractorName: sub?.name || 'Unknown',
      [field]: value || null,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate status based on the new state
    updates.status = getStatus(updates);

    if (!existing) {
      updates.createdAt = new Date().toISOString();
    }

    try {
      await setDoc(doc(db, 'payment-notices', docId), updates, { merge: true });
      toast({ title: 'Period Updated', description: `Milestone saved for ${updates.subcontractorName} in ${selectedPeriod}.` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
    }
  };

  if (noticesLoading || !profile) {
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
            <Banknote className="h-6 w-6 text-primary" />
            Payment Notice Tracking
          </h2>
          <p className="text-sm text-muted-foreground">Manage monthly valuation cycles and subcontractor payments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-muted/30">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Project:
            </div>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
            </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-sm font-bold text-primary shrink-0">
                <FolderKanban className="h-4 w-4" />
                Valuation Period:
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full bg-background border-primary/30 font-semibold text-primary">
                <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {availablePeriods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
            </Select>
            </CardContent>
        </Card>
      </div>

      {selectedProjectId !== 'all' ? (
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/10">
            <div className='flex items-center justify-between'>
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {activeProject?.name}
                    </CardTitle>
                    <CardDescription>Payment ledger for the selected valuation month.</CardDescription>
                </div>
                <Badge variant="outline" className="h-8 px-4 gap-2 text-sm bg-background border-primary/20 text-primary font-bold">
                    <Calendar className="h-4 w-4" />
                    {availablePeriods.find(p => p.value === selectedPeriod)?.label} Cycle
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[220px] pl-6">Subcontractor</TableHead>
                    <TableHead className="text-center">Application Received</TableHead>
                    <TableHead className="text-center">Certificate Issued</TableHead>
                    <TableHead className="text-center">Invoice Received</TableHead>
                    <TableHead className="text-center">Uploaded for Pay</TableHead>
                    <TableHead className="text-right pr-6 w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectSubs.length > 0 ? projectSubs.map(sub => {
                    const noticeId = `${selectedProjectId}_${sub.id}_${selectedPeriod}`;
                    const notice = allNotices?.find(n => n.id === noticeId);
                    return (
                      <TableRow key={sub.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="font-bold pl-6">
                          <div className="flex flex-col">
                            <span>{sub.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-tighter">{sub.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs bg-background" 
                            value={notice?.applicationReceivedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'applicationReceivedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs bg-background" 
                            value={notice?.certificateIssuedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'certificateIssuedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs bg-background" 
                            value={notice?.invoiceReceivedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'invoiceReceivedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs bg-background" 
                            value={notice?.invoiceUploadedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'invoiceUploadedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge variant="outline" className={cn(
                            "capitalize text-[10px] h-5",
                            notice?.status === 'processed' ? "bg-green-100 text-green-800 border-green-200" :
                            notice?.status === 'invoiced' ? "bg-blue-100 text-blue-800 border-blue-200" :
                            notice?.status === 'certified' ? "bg-amber-100 text-amber-800 border-amber-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {notice?.status || 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                        No subcontractors assigned to this project. Update project settings to assign partners.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/10">
            <Banknote className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-lg font-bold text-muted-foreground">No Project Selected</p>
            <p className="text-sm text-muted-foreground">Select a project and valuation period above to manage monthly payment notices.</p>
        </div>
      )}
    </div>
  );
}

export default function PaymentNoticesPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Payment Notices" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <PaymentNoticesContent />
      </Suspense>
    </div>
  );
}
