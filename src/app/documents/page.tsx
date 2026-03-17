
'use client';

import { Header } from '@/components/layout/header';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, Suspense } from 'react';
import type { DrawingDocument, Project, DistributionUser } from '@/lib/types';
import { Loader2, FileText, Filter, ShieldCheck, FolderSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchParams } from 'next/navigation';
import { NewDrawingDialog } from './new-drawing';
import { DrawingCard } from './drawing-card';

function DocumentsContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: sessionUser } = useUser();

  // Filters
  const projectFilter = searchParams.get('project') || 'all';
  const statusFilter = searchParams.get('status') || 'active';

  // Load Data
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const drawingsQuery = useMemoFirebase(() => (db ? query(collection(db, 'drawings'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allDrawings, isLoading: drawingsLoading } = useCollection<DrawingDocument>(drawingsQuery);

  // Security & Visibility
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const filteredDrawings = useMemo(() => {
    if (!allDrawings) return [];
    return allDrawings.filter(doc => {
      const isAuthorised = allowedProjectIds.includes(doc.projectId);
      const matchesProject = projectFilter === 'all' || doc.projectId === projectFilter;
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      return isAuthorised && matchesProject && matchesStatus;
    });
  }, [allDrawings, allowedProjectIds, projectFilter, statusFilter]);

  if (drawingsLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  return (
    <main className="flex-1 flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Drawing Register
          </h2>
          <p className="text-sm text-muted-foreground">Manage project documentation and authorised SharePoint backups.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Control Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NewDrawingDialog 
            projects={allowedProjects} 
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter Register:
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
              <SelectItem value="all">All Authorised Projects</SelectItem>
              {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => {
              const p = new URLSearchParams(window.location.search);
              if (v === 'all') p.delete('status'); else p.set('status', v);
              window.history.pushState(null, '', `?${p.toString()}`);
          }}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Inc. Superseded)</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex-1">
        {filteredDrawings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {filteredDrawings.map(drawing => (
                  <DrawingCard 
                    key={drawing.id} 
                    drawing={drawing} 
                    project={allProjects?.find(p => p.id === drawing.projectId)}
                    currentUser={profile}
                  />
              ))}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg bg-muted/5 text-muted-foreground/40">
            <FolderSearch className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No documents matched your criteria</p>
            <p className="text-sm">Register your first drawing to start the SharePoint backup process.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DocumentsPage() {
  return (
    <div className="flex flex-col w-full min-h-svh">
      <Header title="Document Management" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <DocumentsContent />
      </Suspense>
    </div>
  );
}
