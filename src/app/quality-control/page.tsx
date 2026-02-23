
'use client';

import { Header } from '@/components/layout/header';
import { ChecklistCard } from './checklist-card';
import { AddChecklistToProject } from './add-checklist-to-project';
import { useMemo } from 'react';
import type { QualityChecklist, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';

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
    if (profile.permissions?.canManageProjects) return allProjects;
    
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => {
        const assignments = p.assignedUsers || [];
        return assignments.some(assignedEmail => assignedEmail.toLowerCase().trim() === email);
    });
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const checklistsQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), where('isTemplate', '==', false), orderBy('createdAt', 'desc'))
  , [db]);
  const { data: allProjectChecklists, isLoading: checklistsLoading } = useCollection<QualityChecklist>(checklistsQuery);

  const filteredChecklists = useMemo(() => {
    if (!allProjectChecklists) return [];
    // Strict visibility check
    return allProjectChecklists.filter(c => c.projectId && allowedProjectIds.includes(c.projectId));
  }, [allProjectChecklists, allowedProjectIds]);

  const templatesQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), where('isTemplate', '==', true))
  , [db]);
  const { data: checklistTemplates, isLoading: templatesLoading } = useCollection<QualityChecklist>(templatesQuery);

  const isLoading = projectsLoading || subsLoading || checklistsLoading || templatesLoading || profileLoading;

  if (isLoading) {
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
           <AddChecklistToProject projects={allowedProjects} checklistTemplates={checklistTemplates || []} subContractors={subContractors || []} />
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
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-lg font-semibold">No records found</p>
              <p className="text-sm">You only see checklists for projects you are explicitly assigned to.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
