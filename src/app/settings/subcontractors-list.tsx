
'use client';

import type { SubContractor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { removeSubContractorAction } from './actions';
import { Trash2, Pencil } from 'lucide-react';
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
import { EditSubcontractorForm } from './edit-subcontractor-form';

type SubcontractorsListProps = {
  subContractors: SubContractor[];
};

export function SubcontractorsList({ subContractors }: SubcontractorsListProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (userId: string) => {
    startTransition(async () => {
      await removeSubContractorAction(userId);
    });
  };
  
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {subContractors.map((user) => (
        <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center">
            <EditSubcontractorForm subContractor={user} />
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
                        This will permanently remove {user.name} from the sub-contractor list.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(user.id)} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      {subContractors.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No sub-contractors in the list.</p>
      )}
    </div>
  );
}
