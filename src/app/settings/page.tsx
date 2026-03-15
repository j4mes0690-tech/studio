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
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { AddProjectForm } from './add-project-form';
import { ProjectsList } from './projects-list';
import { NewChecklist } from '../quality-control/new-checklist';
import { ChecklistTemplatesList } from './checklist-templates-list';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import type { DistributionUser, SubContractor, Project, QualityChecklist, PermitTemplate, Invitation } from '@/lib/types';
import { Loader2, ShieldAlert, FileCheck, Tag, Users, UserPlus, ShieldCheck, MailPlus, Sparkles, Building2 } from 'lucide-react';
import { NewPermitTemplate } from './new-permit-template';
import { PermitTemplatesList } from './permit-templates-list';
import { ManageTrades } from './manage-trades';
import { Separator } from '@/components/ui/separator';
import { AddUserDialog } from './add-user-dialog';
import { InviteCollaboratorDialog } from './invite-collaborator-dialog';
import { InvitationsList } from './invitations-list';
import { Suspense } from 'react';
import { Badge } from '@/components/ui/badge';
import { BrandingSettings } from './branding-settings';

function SettingsContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  
  const currentUserRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(currentUserRef);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'), orderBy('name', 'asc'));
  }, [db]);
  const { data: users, isLoading: usersLoading } = useCollection<DistributionUser>(usersQuery);

  const invitesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: invitations, isLoading: invitesLoading } = useCollection<Invitation>(invitesQuery);

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const projsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projsQuery);

  const templatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'quality-checklists'), where('isTemplate', '==', true));
  }, [db]);
  const { data: checklistTemplates, isLoading: templatesLoading } = useCollection<QualityChecklist>(templatesQuery);

  const permitTemplatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'permit-templates');
  }, [db]);
  const { data: permitTemplates, isLoading: permitTemplatesLoading } = useCollection<PermitTemplate>(permitTemplatesQuery);

  const isLoading = profileLoading || usersLoading || subsLoading || projectsLoading || templatesLoading || permitTemplatesLoading || invitesLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const permissions = profile?.permissions;
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
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <Card className="max-w-md w-full p-6 border-destructive/20 bg-destructive/5">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="flex justify-center">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold">Access Denied</h2>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Administrative oversight is required to modify system settings.
                        </p>
                    </div>
                </Card>
            </main>
        </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 space-y-8">
        {hasAnyAdminPermission && (
            <div className="max-w-4xl">
                <BrandingSettings />
            </div>
        )}

        <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="users">
          
          {canManageUsers && (
            <>
              <Card className="overflow-hidden">
                  <AccordionItem value="users" className="border-b-0">
                      <AccordionTrigger className="px-6 py-5 text-xl font-bold hover:no-underline group">
                          <div className="flex items-center gap-3">
                              <Users className="h-6 w-6 text-primary" />
                              <span>System User Directory</span>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-0">
                          <div className="space-y-6">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
                                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      Active System Profiles
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <InviteCollaboratorDialog projects={projects || []} currentUser={profile!} />
                                      <AddUserDialog />
                                  </div>
                              </div>
                              <UsersList users={users || []} />
                          </div>
                      </AccordionContent>
                  </AccordionItem>
              </Card>

              <Card className="overflow-hidden">
                  <AccordionItem value="invitations" className="border-b-0">
                      <AccordionTrigger className="px-6 py-5 text-xl font-bold hover:no-underline group">
                          <div className="flex items-center gap-3">
                              <MailPlus className="h-6 w-6 text-primary" />
                              <span>Onboarding & Invitations</span>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-0">
                          <div className="space-y-6">
                              <div className="flex items-center justify-between border-b pb-4">
                                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      Pending Access Links
                                  </div>
                              </div>
                              <InvitationsList invitations={invitations || []} />
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
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Settings" />
      <Suspense fallback={
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
