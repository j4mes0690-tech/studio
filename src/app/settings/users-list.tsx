
'use client';

import type { DistributionUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { removeUserAction } from './actions';
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
import { EditUserForm } from './edit-user-form';
import { Badge } from '@/components/ui/badge';

type UsersListProps = {
  users: DistributionUser[];
};

export function UsersList({ users }: UsersListProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (userId: string) => {
    startTransition(async () => {
      await removeUserAction(userId);
    });
  };
  
  return (
    <div className="space-y-4">
      {users.map((user) => {
        const isAdmin = user.permissions && Object.values(user.permissions).some(p => p === true);
        return (
          <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {isAdmin && (
                <Badge variant="secondary" className="mt-2">Admin</Badge>
              )}
            </div>
            <div className="flex items-center">
              <EditUserForm user={user} />
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
                          This will permanently remove {user.name} from the distribution list.
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
        )
      })}
      {users.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No users in the distribution list.</p>
      )}
    </div>
  );
}
