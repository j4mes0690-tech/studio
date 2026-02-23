
'use client';

import type { Project, DistributionUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, Users } from 'lucide-react';
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
import { EditProjectForm } from './edit-project-form';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

type ProjectsListProps = {
  projects: Project[];
  users: DistributionUser[];
};

export function ProjectsList({ projects, users }: ProjectsListProps) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();
  const { toast } = useToast();

  const handleRemove = (projectId: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'projects', projectId);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Project removed.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };
  
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {projects.map((project) => (
        <div key={project.id} className="flex items-start justify-between p-3 rounded-lg border">
          <div className="space-y-2">
            <div>
                <p className="font-medium">{project.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                    {(project.areas && project.areas.length > 0) ? project.areas.map(area => (
                        <Badge key={area.id} variant="secondary" className="text-[10px] px-1.5">{area.name}</Badge>
                    )) : <p className="text-[10px] text-muted-foreground">No areas defined</p>}
                </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{project.assignedUsers?.length || 0} users assigned</span>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0">
            <EditProjectForm project={project} users={users} />
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
                        This will permanently remove the project "{project.name}".
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
