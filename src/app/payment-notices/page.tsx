
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { useMemo, useState, Suspense } from 'react';
import type { PaymentNotice, Project, DistributionUser, SubContractor, PaymentNoticeStatus } from '@/lib/types';
import { Loader2, Banknote, Building2, User, Calendar, CheckCircle2, Circle, Clock, Save, History, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function PaymentNoticesContent() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user: sessionUser } = useUser();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const noticesQuery = useMemoFirebase(() => (db ? collection(db, 'payment-notices') : null), [db]);
  const { data: allNotices, isLoading: noticesLoading } = useCollection<PaymentNotice>(noticesQuery);

  // Security
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
    if (!selectedProjectId) return;
    
    const docId = `${selectedProjectId}_${subId}`;
    const existing = allNotices?.find(n => n.id === docId);
    const sub = subContractors?.find(s => s.id === subId);

    const updates: Partial<PaymentNotice> = {
      ...(existing || {}),
      projectId: selectedProjectId,
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
      toast({ title: 'Record Updated', description: `Payment notice milestone saved for ${updates.subcontractorName}.` });
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
          <p className="text-sm text-muted-foreground">Monitor the valuation and certification lifecycle for project trade partners.</p>
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Select Project:
          </div>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-[300px] bg-background">
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedProjectId !== 'all' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {activeProject?.name} Subcontractor Ledger
            </CardTitle>
            <CardDescription>Update payment milestones for assigned trade partners.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px]">Subcontractor</TableHead>
                    <TableHead className="text-center">Application Received</TableHead>
                    <TableHead className="text-center">Certificate Issued</TableHead>
                    <TableHead className="text-center">Invoice Received</TableHead>
                    <TableHead className="text-center">Uploaded for Pay</TableHead>
                    <TableHead className="text-right w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectSubs.length > 0 ? projectSubs.map(sub => {
                    const notice = allNotices?.find(n => n.id === `${selectedProjectId}_${sub.id}`);
                    return (
                      <TableRow key={sub.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="font-bold">
                          <div className="flex flex-col">
                            <span>{sub.name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal uppercase">{sub.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs" 
                            value={notice?.applicationReceivedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'applicationReceivedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs" 
                            value={notice?.certificateIssuedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'certificateIssuedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs" 
                            value={notice?.invoiceReceivedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'invoiceReceivedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="date" 
                            className="h-8 text-xs" 
                            value={notice?.invoiceUploadedDate || ''} 
                            onChange={(e) => handleUpdateDate(sub.id, 'invoiceUploadedDate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
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
            <p className="text-sm text-muted-foreground">Select a project above to view and manage subcontractor payment notices.</p>
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
