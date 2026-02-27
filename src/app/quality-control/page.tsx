'use client';

import { Header } from '@/components/layout/header';
import { ChecklistCard } from './checklist-card';
import { AddChecklistToProject } from './add-checklist-to-project';
import { useMemo } from 'react';
import type { QualityChecklist, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';

export default function QualityControlPage() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();

  // Profile check
  const profileRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Real-time data from Firestore
  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  // Visibility logic
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  // STABLE QUERY: Fetch all checklists ordered by date to avoid composite index requirements.
  // We perform filtering for templates vs project-instances on the client side.
  const checklistsQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), orderBy('createdAt', 'desc'))
  , [db]);
  const { data: allChecklists, isLoading: checklistsLoading } = useCollection<QualityChecklist>(checklistsQuery);

  // Filter for project-specific instances
  const filteredChecklists = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => 
        !c.isTemplate && 
        c.projectId && 
        allowedProjectIds.includes(c.projectId)
    );
  }, [allChecklists, allowedProjectIds]);

  // Filter for templates to be used in the "Add Checklist" dialog
  const checklistTemplates = useMemo(() => {
    if (!allChecklists) return [];
    return allChecklists.filter(c => !!c.isTemplate);
  }, [allChecklists]);

  const isLoading = projectsLoading || subsLoading || checklistsLoading || profileLoading;

  if (isLoading && !allChecklists) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Quality Control" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Quality Control Checklists
          </h2>
           <AddChecklistToProject projects={allowedProjects} checklistTemplates={checklistTemplates} subContractors={subContractors || []} />
        </div>
        
        <div className="grid gap-4 md:gap-6">
          {filteredChecklists.length > 0 ? (
            filteredChecklists.map((checklist) => (
              <ChecklistCard
                key={checklist.id}
                checklist={checklist}
                projects={allowedProjects}
                subContractors={subContractors || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
              <p className="text-lg font-semibold">No records found</p>
              <p className="text-sm">You only see checklists for projects you are explicitly assigned to.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
