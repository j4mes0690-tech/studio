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
import { ChecklistTemplatesList } from './checklist-templates-list';
import { useCollection, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import type { DistributionUser, SubContractor, Project, QualityChecklist, PermitTemplate, Invitation, ToolboxTalkTemplate } from '@/lib/types';
import { Loader2, ShieldAlert, FileCheck, Tag, Users, ShieldCheck, MailPlus, Sparkles, Building2, HardHat, ClipboardCheck, BookOpen, Pencil, Trash2, PlusCircle, Database, Plus } from 'lucide-react';
import { PermitTemplatesList } from './permit-templates-list';
import { ManageTrades } from './manage-trades';
import { Separator } from '@/components/ui/separator';
import { AddUserDialog } from './add-user-dialog';
import { InviteCollaboratorDialog } from './invite-collaborator-dialog';
import { InvitationsList } from './invitations-list';
import { Suspense, useTransition } from 'react';
import { BrandingSettings } from './branding-settings';
import { DatabaseCleanup } from './database-cleanup';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function SettingsContent() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { email } = useUser();
  
  const currentUserRef = useMemoFirebase(() => {
    if (!db || !email) return null;
    return doc(db, 'users', email.toLowerCase().trim());
  }, [db, email]);

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
    return query(collection(db, 'permit-templates'));
  }, [db]);
  const { data: permitTemplates, isLoading: permitTemplatesLoading } = useCollection<PermitTemplate>(permitTemplatesQuery);

  const toolboxTemplatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'toolbox-talk-templates'));
  }, [db]);
  const { data: toolboxTemplates, isLoading: toolboxLoading } = useCollection<ToolboxTalkTemplate>(toolboxTemplatesQuery);

  const isLoading = profileLoading || usersLoading || subsLoading || projectsLoading || templatesLoading || permitTemplatesLoading || invitesLoading || toolboxLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const permissions = profile?.permissions;
  const adminEmail = 'admin@example.com';
  const isAdmin = email?.toLowerCase().trim() === adminEmail;
  
  const canManageBranding = !!permissions?.canManageBranding || isAdmin;
  const canManageUsers = !!permissions?.canManageUsers || isAdmin;
  const canManageSubcontractors = !!permissions?.canManageSubcontractors || isAdmin;
  const canManageProjects = !!permissions?.canManageProjects || isAdmin;
  const canManageChecklists = !!permissions?.canManageChecklists || isAdmin;
  const canManagePermitTemplates = !!permissions?.canManagePermitTemplates || isAdmin;
  const canManageMaintenance = !!permissions?.hasFullVisibility || isAdmin;

  const hasAnyAdminPermission = canManageBranding || canManageUsers || canManageSubcontractors || canManageProjects || canManageChecklists || canManagePermitTemplates || canManageMaintenance;

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

  const handleDeleteToolbox = (id: string) => {
    startTransition(async () => {
        await deleteDoc(doc(db!, 'toolbox-talk-templates', id));
        toast({ title: 'Template Removed' });
    });
  };

  return (
    <main className="flex-1 p-4 md:p-8 space-y-4 pb-20">
        <Accordion type="single" collapsible className="w-full space-y-4">
          
          {canManageBranding && <BrandingSettings />}

          {canManageUsers && (
            <>
              <Card className="overflow-hidden">
                  <AccordionItem value="users" className="border-b-0">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                          <div className="flex items-center gap-3 text-left w-full">
                              <Users className="h-5 w-5 text-primary shrink-0" />
                              <span className="text-base font-bold">System User Directory</span>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-0 border-t">
                          <div className="space-y-6 pt-6">
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
                      <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                          <div className="flex items-center gap-3 text-left w-full">
                              <MailPlus className="h-5 w-5 text-primary shrink-0" />
                              <span className="text-base font-bold">Onboarding & Invitations</span>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-0 border-t">
                          <div className="space-y-6 pt-6">
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
            <Card className="overflow-hidden">
                <AccordionItem value="subcontractors" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left w-full">
                            <HardHat className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-base font-bold">Manage External Partners</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0 border-t">
                        <div className="space-y-8 pt-6">
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
            <Card className="overflow-hidden">
                <AccordionItem value="projects" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left w-full">
                            <Building2 className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-base font-bold">Manage Projects</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0 border-t">
                        <div className="grid gap-8 lg:grid-cols-2 pt-6">
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
            <Card className="overflow-hidden">
                <AccordionItem value="checklists" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left w-full">
                            <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-base font-bold">Master Templates (QC & Toolbox)</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0 border-t">
                        <div className="grid gap-8 lg:grid-cols-2 pt-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-lg font-medium">Publish in Studio</h3>
                                    <p className="text-xs text-muted-foreground">Use the Form Editor to build advanced interactive templates.</p>
                                </div>
                                <Button asChild className="gap-2 w-full h-12 text-lg font-bold">
                                    <Link href="/form-creator">
                                        <Sparkles className="h-5 w-5" />
                                        Launch Form Studio
                                    </Link>
                                </Button>
                            </div>
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Trade QC Library</h3>
                                        <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 font-bold border-primary/20 text-primary">
                                            <Link href="/form-creator?type=qc">
                                                <Plus className="h-3.5 w-3.5" /> New QC Template
                                            </Link>
                                        </Button>
                                    </div>
                                    <ChecklistTemplatesList checklistTemplates={checklistTemplates || []} />
                                </div>
                                <Separator />
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Toolbox Talk Library</h3>
                                        <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 font-bold border-primary/20 text-primary">
                                            <Link href="/form-creator?type=toolbox">
                                                <Plus className="h-3.5 w-3.5" /> New Talk
                                            </Link>
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {toolboxTemplates?.map(t => (
                                            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/5 group">
                                                <div>
                                                    <p className="font-bold text-sm">{t.title}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{t.trade}</p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                                                        <Link href={`/form-creator?type=toolbox&id=${t.id}`}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Remove Toolbox Talk?</AlertDialogTitle><AlertDialogDescription>Delete the template "{t.title}".</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteToolbox(t.id)} className="bg-destructive">Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Separator className="my-8" />
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Tag className="h-5 w-5" />
                                <h3>Trade Categories</h3>
                            </div>
                            <ManageTrades />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {canManagePermitTemplates && (
            <Card className="overflow-hidden">
                <AccordionItem value="permit-templates" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left w-full">
                            <FileCheck className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-base font-bold">Manage Permit Templates</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0 border-t">
                        <div className="grid gap-8 lg:grid-cols-2 pt-6">
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-lg font-medium">Permit Designer</h3>
                                    <p className="text-xs text-muted-foreground">Create specialized electronic permits with custom verification sections.</p>
                                </div>
                                <Button asChild className="gap-2 w-full h-12 text-lg font-bold">
                                    <Link href="/form-creator?type=permit">
                                        <PlusCircle className="h-5 w-5" />
                                        Create New Permit Template
                                    </Link>
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">System Library</h3>
                                <PermitTemplatesList templates={permitTemplates || []} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Card>
          )}

          {canManageMaintenance && (
            <Card className="overflow-hidden border-destructive/30">
                <AccordionItem value="maintenance" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                        <div className="flex items-center gap-3 text-left w-full">
                            <Database className="h-5 w-5 text-destructive shrink-0" />
                            <span className="text-base font-bold text-destructive">Database Maintenance</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 py-6 pt-0 border-t">
                        <div className="pt-6">
                            <DatabaseCleanup />
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
    <div className="flex flex-col w-full min-h-screen bg-background">
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
