
import { Header } from '@/components/layout/header';
import { getProjects, getQualityChecklists } from '@/lib/data';
import { ChecklistCard } from './checklist-card';

export const dynamic = 'force-dynamic';

export default async function QualityControlPage() {
  const [projects, checklists] = await Promise.all([
    getProjects(),
    getQualityChecklists({}),
  ]);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Quality Control" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Quality Control Checklists
          </h2>
        </div>
        
        <div className="grid gap-4 md:gap-6">
          {checklists.length > 0 ? (
            checklists.map((checklist) => (
              <ChecklistCard
                key={checklist.id}
                checklist={checklist}
                projects={projects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-lg font-semibold">No checklists yet.</p>
              <p className="text-sm">Create checklists from the Settings page.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
