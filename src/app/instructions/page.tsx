
import { Header } from '@/components/layout/header';
import { getProjects, getInstructions, getDistributionUsers } from '@/lib/data';
import { InstructionCard } from './instruction-card';
import { NewInstruction } from './new-instruction';
import { InstructionFilters } from './instruction-filters';
import { ExportButton } from './export-button';

export const dynamic = 'force-dynamic';

export default async function InstructionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const projectId =
    typeof searchParams.project === 'string' ? searchParams.project : undefined;

  const [instructions, allProjects, distributionUsers] = await Promise.all([
    getInstructions({ projectId }),
    getProjects(),
    getDistributionUsers(),
  ]);

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Instructions" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Instruction Log
          </h2>
          <div className="flex items-center gap-2">
            <NewInstruction projects={allProjects} distributionUsers={distributionUsers} />
          </div>
        </div>
        <InstructionFilters projects={allProjects} />
        <div className="grid gap-4 md:gap-6">
          {instructions.length > 0 ? (
            instructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
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
        {instructions.length > 0 && (
          <div className="flex justify-center mt-auto pt-6">
            <ExportButton instructions={instructions} projects={allProjects} />
          </div>
        )}
      </main>
    </div>
  );
}
