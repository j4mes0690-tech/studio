
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
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { AddProjectForm } from './add-project-form';
import { ProjectsList } from './projects-list';
import { NewChecklist } from '../quality-control/new-checklist';
import { ChecklistTemplatesList } from './checklist-templates-list';
import { ManageTradesDialog } from './manage-trades-dialog';
import { ManageTrades } from './manage-trades';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { DistributionUser, SubContractor, Project, QualityChecklist } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  
  // Fetch current user's profile to check permissions
  const currentUserRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  // Fetch all users list
  const usersQuery = useMemo(() => collection(db, 'users'), [db]);
  const { data: users, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // Fetch Subcontractors / Designers
  const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  // Fetch Projects
  const projsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projsQuery);

  // Fetch Checklist Templates
  const templatesQuery = useMemo(() => query(collection(db, 'quality-checklists'), where('isTemplate', '==', true)), [db]);
  const { data: checklistTemplates, isLoading: templatesLoading } = useCollection<QualityChecklist>(templatesQuery);

  const isLoading = profileLoading || usersLoading || subsLoading || projectsLoading || templatesLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const permissions = profile?.permissions;
  const hasAnyAdminPermission = permissions && (
    permissions.canManageUsers || 
    permissions.canManageSubcontractors || 
    permissions.canManageProjects || 
    permissions.canManageTrades ||
    permissions.canManageChecklists
  );

  if (!hasAnyAdminPermission) {
    return (
        <div className="flex flex-col w-full">
            <Header title="Settings" />
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                        </div>
                        <CardTitle>Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-muted-foreground">You do not have administrative permissions to manage system settings.</p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <Header title="Settings" />
      <main className="flex-1 p-4 md:p-8">
        <Accordion type="single" collapsible className="w-full space-y-4">
          
          {permissions.canManageUsers && (
            <Card>
                <AccordionItem value="users" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Internal Users</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Add New User</h3>
                                <AddUserForm />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Existing Users</h3>
                                <UsersList users={users || []} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {permissions.canManageSubcontractors && (
            <Card>
                <AccordionItem value="subcontractors" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage External Contacts & Trades</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">Add New External Contact</h3>
                                    {permissions.canManageTrades && <ManageTradesDialog />}
                                </div>
                                <AddSubcontractorForm canManageTrades={permissions.canManageTrades} />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Existing Partners</h3>
                                <SubcontractorsList subContractors={subContractors || []} canManageTrades={permissions.canManageTrades} />
                            </div>
                        </div>

                        {permissions.canManageTrades && (
                          <div className="mt-12 space-y-6 pt-8 border-t">
                            <div className="flex flex-col gap-1">
                              <h3 className="text-xl font-bold tracking-tight">Trade Category Management</h3>
                              <p className="text-sm text-muted-foreground">Define the trade specialties used for partner assignment and quality checklists.</p>
                            </div>
                            <ManageTrades />
                          </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {permissions.canManageProjects && (
            <Card>
                <AccordionItem value="projects" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Projects</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Add New Project</h3>
                                <AddProjectForm />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Existing Projects</h3>
                                <ProjectsList projects={projects || []} users={users || []} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {permissions.canManageChecklists && (
            <Card>
                <AccordionItem value="checklists" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Checklist Templates</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Add New Template</h3>
                                <NewChecklist />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Existing Templates</h3>
                                <ChecklistTemplatesList checklistTemplates={checklistTemplates || []} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}
        </Accordion>
      </main>
    </div>
  );
}
