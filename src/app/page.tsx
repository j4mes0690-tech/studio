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
import { getClients, getInstructions, getProjects } from '@/lib/data';
import { Header } from '@/components/layout/header';
import { Users, FolderKanban, MessageSquare } from 'lucide-react';
import type { Instruction, Project, Client } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Dashboard() {
  const [instructions, projects, clients] = await Promise.all([
    getInstructions({}),
    getProjects(),
    getClients(),
  ]);

  const recentInstructions = instructions.slice(0, 5);
  const instructionMap = new Map<string, Instruction>(instructions.map((i) => [i.id, i]));
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const clientMap = new Map<string, Client>(clients.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col w-full">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Instructions
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{instructions.length}</div>
              <p className="text-xs text-muted-foreground">
                Across all projects
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Projects
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently active and archived
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">
                Managed across the firm
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Instructions</CardTitle>
              <CardDescription>
                The latest instructions recorded from clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="hidden sm:table-cell">Client</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInstructions.map((instruction) => {
                    const project = projectMap.get(instruction.projectId);
                    const client = clientMap.get(instruction.clientId);
                    return (
                      <TableRow key={instruction.id}>
                        <TableCell>
                          <div className="font-medium">
                            {project?.name || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {client?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Date(instruction.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
               <div className="mt-4 flex justify-end">
                <Button asChild variant="outline">
                    <Link href="/instructions">View All Instructions</Link>
                </Button>
            </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Projects Overview</CardTitle>
              <CardDescription>
                An overview of all your projects.
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
                  {projects.slice(0, 5).map(p => {
                    const instructionCount = instructions.filter(i => i.projectId === p.id).length;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="hidden text-sm text-muted-foreground md:inline">
                            {clientMap.get(p.clientId)?.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{instructionCount}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <Button asChild variant="outline">
                    <Link href="/projects">View All Projects</Link>
                </Button>
            </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
