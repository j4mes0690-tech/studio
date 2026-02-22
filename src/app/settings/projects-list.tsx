
'use client';

import type { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { removeProjectAction } from './actions';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ProjectsListProps = {
  projects: Project[];
};

export function ProjectsList({ projects }: ProjectsListProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (projectId: string) => {
    startTransition(async () => {
      await removeProjectAction(projectId);
    });
  };
  
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {projects.map((project) => (
        <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{project.name}</p>
          </div>
          <div className="flex items-center">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove the project "{project.name}". This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(project.id)} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      {projects.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No projects found.</p>
      )}
    </div>
  );
}
