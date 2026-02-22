
import { Header } from '@/components/layout/header';

export default async function QualityControlPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Quality Control" />
      <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Quality Control Checklists
          </h2>
        </div>
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg font-semibold">Coming Soon!</p>
            <p className="text-sm">This section is under construction. You will soon be able to manage quality control checklists here.</p>
        </div>
      </main>
    </div>
  );
}
