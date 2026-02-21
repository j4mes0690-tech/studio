
import { Header } from '@/components/layout/header';
import { getProjects, getSnaggingLists } from '@/lib/data';
import { SnaggingItemCard } from './snagging-card';
import { NewSnaggingItem } from './new-snagging-item';
import { SnaggingFilters } from './snagging-filters';
import { ExportButton } from './export-button';

export const dynamic = 'force-dynamic';

export default async function SnaggingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId =
    typeof searchParams.project === 'string' ? searchParams.project : undefined;

  const [items, allProjects] = await Promise.all([
    getSnaggingLists({ projectId }),
    getProjects(),
  ]);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Snagging Lists" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Snagging Log
          </h2>
          <div className="flex items-center gap-2">
            <NewSnaggingItem projects={allProjects} />
          </div>
        </div>
        <SnaggingFilters projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {items.length > 0 ? (
            items.map((item) => (
              <SnaggingItemCard
                key={item.id}
                item={item}
                projects={allProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No snagging items found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new item.</p>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton items={items} projects={allProjects} />
          </div>
        )}
      </main>
    </div>
  );
}
