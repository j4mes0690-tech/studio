
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
import { getDistributionUsers, getSubContractors, getProjects, getQualityChecklists } from '@/lib/data';
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { AddProjectForm } from './add-project-form';
import { ProjectsList } from './projects-list';
import { NewChecklist } from '../quality-control/new-checklist';
import { ChecklistTemplatesList } from './checklist-templates-list';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [users, subContractors, projects, checklistTemplates] = await Promise.all([
      getDistributionUsers(),
      getSubContractors(),
      getProjects(),
      getQualityChecklists({ template: true }),
  ]);

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
                            <p className="text-sm text-muted-foreground">Add users to the distribution list for instructions.</p>
                            <AddUserForm />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Existing Users</h3>
                             <p className="text-sm text-muted-foreground invisible">Placeholder for alignment.</p>
                            <UsersList users={users} />
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
                             <p className="text-sm text-muted-foreground invisible">Placeholder for alignment.</p>
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
