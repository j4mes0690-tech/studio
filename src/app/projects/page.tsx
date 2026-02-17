import { Header } from '@/components/layout/header';
import { getClients, getProjects, getInstructions } from '@/lib/data';
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
import type { Client, Project, Instruction } from '@/lib/types';

export default async function ProjectsPage() {
  const [projects, clients, instructions] = await Promise.all([
    getProjects(),
    getClients(),
    getInstructions({}),
  ]);
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col w-full">
      <Header title="Projects" />
      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Project Directory</CardTitle>
            <CardDescription>
              A list of all projects across all clients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="hidden sm:table-cell">Client</TableHead>
                  <TableHead className="text-right">Instructions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const projectInstructions = instructions.filter(
                    (i) => i.projectId === project.id
                  );
                  const client = clientMap.get(project.clientId);
                  return (
                    <TableRow
                      key={project.id}
                      href={`/instructions?project=${project.id}`}
                    >
                      <TableCell>
                        <div className="font-medium">{project.name}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {client?.name || 'N/A'}
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
