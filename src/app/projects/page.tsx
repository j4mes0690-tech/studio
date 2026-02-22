
'use client';

import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import type { Project, Instruction } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function ProjectsPage() {
  const db = useFirestore();

  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const instructionsQuery = useMemo(() => collection(db, 'instructions'), [db]);
  const { data: instructions, isLoading: instructionsLoading } = useCollection<Instruction>(instructionsQuery);

  const loading = projectsLoading || instructionsLoading;

  if (loading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <Header title="Projects" />
      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Project Directory</CardTitle>
            <CardDescription>
              A list of all projects and the volume of instructions recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Instructions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects && projects.length > 0 ? projects.map((project) => {
                  const projectInstructions = (instructions || []).filter(
                    (i) => i.projectId === project.id
                  );
                  return (
                    <TableRow
                      key={project.id}
                      href={`/instructions?project=${project.id}`}
                    >
                      <TableCell>
                        <div className="font-medium">{project.name}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {projectInstructions.length}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                            No projects found. Add some in System Settings.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
