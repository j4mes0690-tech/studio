'use client';

import { Header } from '@/components/layout/header';
import { ChecklistCard } from './checklist-card';
import { AddChecklistToProject } from './add-checklist-to-project';
import { useMemo } from 'react';
import type { QualityChecklist, Project, SubContractor } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

export default function QualityControlPage() {
  const db = useFirestore();

  // Real-time data from Firestore
  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const checklistsQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), where('isTemplate', '==', false), orderBy('createdAt', 'desc'))
  , [db]);
  const { data: projectChecklists, isLoading: checklistsLoading } = useCollection<QualityChecklist>(checklistsQuery);

  const templatesQuery = useMemo(() => 
    query(collection(db, 'quality-checklists'), where('isTemplate', '==', true))
  , [db]);
  const { data: checklistTemplates, isLoading: templatesLoading } = useCollection<QualityChecklist>(templatesQuery);

  const isLoading = projectsLoading || subsLoading || checklistsLoading || templatesLoading;

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
           <AddChecklistToProject projects={projects || []} checklistTemplates={checklistTemplates || []} subContractors={subContractors || []} />
        </div>
        
        <div className="grid gap-4 md:gap-6">
          {projectChecklists && projectChecklists.length > 0 ? (
            projectChecklists.map((checklist) => (
              <ChecklistCard
                key={checklist.id}
                checklist={checklist}
                projects={projects || []}
                subContractors={subContractors || []}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-lg font-semibold">No checklists assigned to projects.</p>
              <p className="text-sm">Click "Add Checklist" to assign a template to a project.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
