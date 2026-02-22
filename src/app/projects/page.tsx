
'use client';

import { Header } from '@/components/layout/header';
import { getProjects, getInstructions } from '@/lib/data';
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
import { useEffect, useState } from 'react';
import type { Project, Instruction } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [proj, inst] = await Promise.all([
        getProjects(),
        getInstructions({}),
      ]);
      setProjects(proj);
      setInstructions(inst);
      setLoading(false);
    }
    loadData();
  }, []);

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
              A list of all projects.
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
                {projects.map((project) => {
                  const projectInstructions = instructions.filter(
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
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
