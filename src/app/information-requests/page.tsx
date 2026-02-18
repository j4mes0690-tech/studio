
import { Header } from '@/components/layout/header';
import { getClients, getProjects, getInformationRequests, getDistributionUsers } from '@/lib/data';
import { InformationRequestCard } from './information-request-card';
import { NewInformationRequest } from './new-information-request';
import { InformationRequestFilters } from './information-request-filters';
import { ExportButton } from './export-button';

export const dynamic = 'force-dynamic';

export default async function InformationRequestsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const clientId =
    typeof searchParams.client === 'string' ? searchParams.client : undefined;
  const projectId =
    typeof searchParams.project === 'string' ? searchParams.project : undefined;

  const [items, clients, allProjects, distributionUsers] = await Promise.all([
    getInformationRequests({ clientId, projectId }),
    getClients(),
    getProjects(),
    getDistributionUsers(),
  ]);

  return (
    <div className="flex flex-col w-full">
      <Header title="Information Requests" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Information Request Log
          </h2>
          <div className="flex items-center gap-2">
            <ExportButton items={items} clients={clients} projects={allProjects} distributionUsers={distributionUsers} />
            <NewInformationRequest clients={clients} projects={allProjects} distributionUsers={distributionUsers} />
          </div>
        </div>
        <InformationRequestFilters clients={clients} projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {items.length > 0 ? (
            items.map((item) => (
              <InformationRequestCard
                key={item.id}
                item={item}
                clients={clients}
                projects={allProjects}
                distributionUsers={distributionUsers}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No information requests found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new item.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
