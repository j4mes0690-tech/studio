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
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { AddProjectForm } from './add-project-form';
import { ProjectsList } from './projects-list';
import { NewChecklist } from '../quality-control/new-checklist';
import { ChecklistTemplatesList } from './checklist-templates-list';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import type { DistributionUser, SubContractor, Project, QualityChecklist, PermitTemplate, Invitation } from '@/lib/types';
import { Loader2, ShieldAlert, FileCheck, Tag, MailPlus, Users, UserCog, UserPlus } from 'lucide-react';
import { NewPermitTemplate } from './new-permit-template';
import { PermitTemplatesList } from './permit-templates-list';
import { ManageTrades } from './manage-trades';
import { Separator } from '@/components/ui/separator';
import { InviteCollaboratorDialog } from './invite-collaborator-dialog';
import { InvitationsList } from './invitations-list';
import { AddUserDialog } from './add-user-dialog';

export default function SettingsPage() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  
  // Fetch current user's profile to check permissions
  const currentUserRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  // Fetch all users list
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: users, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  // Fetch Invitations
  const invitesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: invitations, isLoading: invitesLoading } = useCollection<Invitation>(invitesQuery);

  // Fetch Sub-contractors / Designers / Suppliers
  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  // Fetch Projects
  const projsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projsQuery);

  // Fetch Checklist Templates
  const templatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'quality-checklists'), where('isTemplate', '==', true));
  }, [db]);
  const { data: checklistTemplates, isLoading: templatesLoading } = useCollection<QualityChecklist>(templatesQuery);

  // Fetch Permit Templates
  const permitTemplatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'permit-templates');
  }, [db]);
  const { data: permitTemplates, isLoading: permitTemplatesLoading } = useCollection<PermitTemplate>(permitTemplatesQuery);

  const isLoading = profileLoading || usersLoading || subsLoading || projectsLoading || templatesLoading || permitTemplatesLoading || invitesLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const permissions = profile?.permissions;
  
  // Resilient permission check
  const isAdmin = profile?.email.toLowerCase().trim() === 'admin@example.com';
  const canManageUsers = !!permissions?.canManageUsers || isAdmin;
  const canManageSubcontractors = !!permissions?.canManageSubcontractors || isAdmin;
  const canManageProjects = !!permissions?.canManageProjects || isAdmin;
  const canManageChecklists = !!permissions?.canManageChecklists || isAdmin;
  const canManagePermitTemplates = !!permissions?.canManagePermitTemplates || isAdmin;
  const canManageTraining = !!permissions?.canManageTraining || isAdmin;

  const hasAnyAdminPermission = canManageUsers || canManageSubcontractors || canManageProjects || canManageChecklists || canManagePermitTemplates || canManageTraining;

  if (!hasAnyAdminPermission) {
    return (
        <div className="flex flex-col w-full">
            <Header title="Settings" />
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <Card className="max-w-md w-full p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="flex justify-center">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold">Access Denied</h2>
                        <p className="text-muted-foreground">You do not have administrative permissions to manage system settings.</p>
                    </div>
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
          
          {canManageUsers && (
            <>
              <Card>
                  <AccordionItem value="users" className="border-b-0">
                      <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Active Users</AccordionTrigger>
                      <AccordionContent className="p-6 pt-0">
                          <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-muted-foreground font-bold">
                                      <Users className="h-5 w-5" />
                                      <h3 className="text-lg">System User Directory</h3>
                                  </div>
                                  <AddUserDialog />
                              </div>
                              <UsersList users={users || []} />
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Card>

              <Card>
                  <AccordionItem value="invitations" className="border-b-0">
                      <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Collaborator Onboarding</AccordionTrigger>
                      <AccordionContent className="p-6 pt-0">
                          <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-primary font-bold">
                                      <MailPlus className="h-5 w-5" />
                                      <h3 className="text-lg">Pending Invitations</h3>
                                  </div>
                                  <InviteCollaboratorDialog projects={projects || []} currentUser={profile!} />
                              </div>
                              <InvitationsList invitations={invitations || []} />
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Card>

              <Card>
                  <AccordionItem value="manual-profile" className="border-b-0">
                      <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manual Profile Setup</AccordionTrigger>
                      <AccordionContent className="p-6 pt-0">
                          <div className="space-y-6">
                              <div className="flex items-center gap-2 text-primary font-bold">
                                  <UserCog className="h-5 w-5" />
                                  <h3 className="text-lg">New Account Configuration</h3>
                              </div>
                              <div className="max-w-2xl border rounded-lg p-6 bg-muted/5">
                                  <AddUserForm />
                              </div>
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Card>
            </>
          )}

          {canManageSubcontractors && (
            <Card>
                <AccordionItem value="subcontractors" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage External Partners</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="space-y-8">
                            <div className="grid gap-8 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Add New External Partner</h3>
                                    <AddSubcontractorForm />
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Partner Directory</h3>
                                    <SubcontractorsList subContractors={subContractors || []} />
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {canManageProjects && (
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

          {canManageChecklists && (
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
                        <Separator className="my-8" />
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Tag className="h-5 w-5" />
                                <h3>Trade Categories</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">Define the trade disciplines available for checklist assignment.</p>
                            <ManageTrades />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {canManagePermitTemplates && (
            <Card>
                <AccordionItem value="permit-templates" className="border-b-0">
                    <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">Manage Permit Templates</AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-primary font-bold">
                                    <FileCheck className="h-5 w-5" />
                                    <h3>Create Master Template</h3>
                                </div>
                                <NewPermitTemplate />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">System Library</h3>
                                <PermitTemplatesList templates={permitTemplates || []} />
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
