
'use client';

import { Suspense, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { DistributionUser, Project } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ProjectInsightsContent } from './project-insights-content';

function InsightsPageContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();

  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const isLoading = profileLoading || projectsLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  // Security Gate
  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;
  const isAdmin = profile?.email.toLowerCase().trim() === 'admin@example.com';

  if (!hasFullVisibility && !isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4 opacity-20" />
            <h3 className="text-xl font-bold">Executive Access Restricted</h3>
            <p className="text-muted-foreground text-sm max-w-md mt-2">
                Project Insights provide sensitive financial and procurement overviews. Please contact your administrator to enable "Global Visibility" for your profile.
            </p>
        </div>
    );
  }

  if (allowedProjects.length === 0) {
    return (
        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/10 mx-4 md:mx-8">
            <p className="text-lg font-bold text-muted-foreground">No projects assigned.</p>
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 lg:p-10">
        <ProjectInsightsContent allowedProjects={allowedProjects} />
    </main>
  );
}

export default function ProjectInsightsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-muted/10">
      <Header title="Project Insights" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <InsightsPageContent />
      </Suspense>
    </div>
  );
}
