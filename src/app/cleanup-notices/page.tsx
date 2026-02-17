
import { Header } from '@/components/layout/header';
import { getClients, getProjects, getCleanUpNotices, getSubContractors } from '@/lib/data';
import { NoticeCard } from './notice-card';
import { NewNotice } from './new-notice';
import { NoticeFilters } from './notice-filters';
import { ExportButton } from './export-button';

export const dynamic = 'force-dynamic';

export default async function CleanUpNoticesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const clientId =
    typeof searchParams.client === 'string' ? searchParams.client : undefined;
  const projectId =
    typeof searchParams.project === 'string' ? searchParams.project : undefined;

  const [notices, clients, allProjects, subContractors] = await Promise.all([
    getCleanUpNotices({ clientId, projectId }),
    getClients(),
    getProjects(),
    getSubContractors(),
  ]);

  return (
    <div className="flex flex-col w-full">
      <Header title="Clean Up Notices" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Notice Log
          </h2>
          <div className="flex items-center gap-2">
            <ExportButton notices={notices} clients={clients} projects={allProjects} />
            <NewNotice clients={clients} projects={allProjects} subContractors={subContractors} />
          </div>
        </div>
        <NoticeFilters clients={clients} projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                clients={clients}
                projects={allProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No clean up notices found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new notice.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
