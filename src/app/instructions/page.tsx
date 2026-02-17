import { Header } from '@/components/layout/header';
import { getClients, getProjects, getInstructions } from '@/lib/data';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';

export const dynamic = 'force-dynamic';

export default async function InstructionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const clientId =
    typeof searchParams.client === 'string' ? searchParams.client : undefined;
  const projectId =
    typeof searchParams.project === 'string' ? searchParams.project : undefined;

  const [instructions, clients, allProjects] = await Promise.all([
    getInstructions({ clientId, projectId }),
    getClients(),
    getProjects(),
  ]);

  return (
    <div className="flex flex-col w-full">
      <Header title="Instructions" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Instruction Log
          </h2>
          <NewInstruction clients={clients} projects={allProjects} />
        </div>
        <InstructionFilters clients={clients} projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {instructions.length > 0 ? (
            instructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
                clients={clients}
                projects={allProjects}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No instructions found.</p>
              <p className="text-sm">Try adjusting your filters or adding a new instruction.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
