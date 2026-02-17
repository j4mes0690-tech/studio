import { Header } from '@/components/layout/header';
import { getClients, getInstructions, getProjects } from '@/lib/data';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Client, Project, Instruction } from '@/lib/types';

export default async function ClientsPage() {
  const [clients, projects, instructions] = await Promise.all([
    getClients(),
    getProjects(),
    getInstructions({}),
  ]);

  return (
    <div className="flex flex-col w-full">
      <Header title="Clients" />
      <main className="flex-1 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Client Overview</CardTitle>
            <CardDescription>
              A list of all clients and their project activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden sm:table-cell">Projects</TableHead>
                  <TableHead className="text-right">Instructions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const clientProjects = projects.filter(
                    (p) => p.clientId === client.id
                  );
                  const clientInstructions = instructions.filter(
                    (i) => i.clientId === client.id
                  );
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={client.avatarUrl}
                              alt={client.name}
                            />
                            <AvatarFallback>
                              {client.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="font-medium">{client.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{clientProjects.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{clientInstructions.length}</Badge>
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
