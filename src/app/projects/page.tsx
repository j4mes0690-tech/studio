
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
import type { Project, Instruction, DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

export default function ProjectsPage() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();

  const userProfileRef = useMemo(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(userProfileRef);

  const projectsQuery = useMemo(() => collection(db, 'projects'), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const instructionsQuery = useMemo(() => collection(db, 'instructions'), [db]);
  const { data: instructions, isLoading: instructionsLoading } = useCollection<Instruction>(instructionsQuery);

  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    
    // Project management admins see everything
    if (profile.permissions?.canManageProjects) return allProjects;

    // Others only see projects they are assigned to
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => p.assignedUsers?.includes(email));
  }, [allProjects, profile]);

  const loading = projectsLoading || instructionsLoading || profileLoading;

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
              A list of projects you have access to and the volume of records captured.
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
                {allowedProjects && allowedProjects.length > 0 ? allowedProjects.map((project) => {
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
                            No projects found or you haven't been assigned to any.
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
