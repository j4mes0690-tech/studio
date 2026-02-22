
'use client';

import { Header } from '@/components/layout/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Card,
} from '@/components/ui/card';
import { getSubContractors, getProjects, getQualityChecklists } from '@/lib/data';
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { AddProjectForm } from './add-project-form';
import { ProjectsList } from './projects-list';
import { NewChecklist } from '../quality-control/new-checklist';
import { ChecklistTemplatesList } from './checklist-templates-list';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { DistributionUser, SubContractor, Project, QualityChecklist } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const db = useFirestore();
  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: users, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const [subContractors, setSubContractors] = useState<SubContractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<QualityChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [subs, projs, templates] = await Promise.all([
        getSubContractors(),
        getProjects(),
        getQualityChecklists({ template: true }),
      ]);
      setSubContractors(subs);
      setProjects(projs);
      setChecklistTemplates(templates);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading || usersLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <Header title="Settings" />
      <main className="flex-1 p-4 md:p-8">
        <Accordion type="single" collapsible className="w-full space-y-4">
          <Card>
            <AccordionItem value="users" className="border-b-0">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Users</AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Add New User</h3>
                            <p className="text-sm text-muted-foreground">Add users to the distribution list. You must still add their credentials manually in the Firebase Console.</p>
                            <AddUserForm />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Existing Users</h3>
                             <p className="text-sm text-muted-foreground">Internal profiles and permissions.</p>
                            <UsersList users={users || []} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
            <AccordionItem value="subcontractors" className="border-b-0">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Sub-Contractors</AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Add New Sub-Contractor</h3>
                            <p className="text-sm text-muted-foreground">Add sub-contractor companies to the system.</p>
                            <AddSubcontractorForm />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Existing Sub-Contractors</h3>
                             <p className="text-sm text-muted-foreground invisible">Placeholder</p>
                            <SubcontractorsList subContractors={subContractors} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
             <AccordionItem value="projects" className="border-b-0">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Projects</AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Add New Project</h3>
                             <p className="text-sm text-muted-foreground">Add a new project to the system.</p>
                            <AddProjectForm />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Existing Projects</h3>
                             <p className="text-sm text-muted-foreground">Edit project names and manage project areas.</p>
                            <ProjectsList projects={projects} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Card>

          <Card>
             <AccordionItem value="checklists" className="border-b-0">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Checklist Templates</AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Add New Template</h3>
                            <p className="text-sm text-muted-foreground">Create new quality control checklist templates.</p>
                            <NewChecklist />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Existing Templates</h3>
                             <p className="text-sm text-muted-foreground">Edit or delete existing checklist templates.</p>
                            <ChecklistTemplatesList checklistTemplates={checklistTemplates} />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
          </Card>
        </Accordion>
      </main>
    </div>
  );
}
