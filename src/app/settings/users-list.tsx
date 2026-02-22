
'use client';

import type { DistributionUser } from '@/lib/types';
import { Button } from '@/components/ui/button';
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
import { EditUserForm } from './edit-user-form';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

type UsersListProps = {
  users: DistributionUser[];
};

export function UsersList({ users }: UsersListProps) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();
  const { toast } = useToast();

  const handleRemove = (user: DistributionUser) => {
    startTransition(async () => {
      const docId = user.id || user.email;
      const docRef = doc(db, 'users', docId);
      
      deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Success', description: 'User profile removed.' });
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };
  
  return (
    <div className="space-y-4">
      {users.map((user) => {
        const isAdmin = user.permissions && Object.values(user.permissions).some(p => p === true);
        return (
          <div key={user.id || user.email} className="flex items-center justify-between p-3 rounded-lg border">
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
                          This will remove {user.name}'s profile and permissions. Their login account will still exist in Firebase Authentication unless removed from the console.
                      </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRemove(user)} className="bg-destructive hover:bg-destructive/90">
                          {isPending ? 'Deleting...' : 'Delete Profile'}
                      </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )
      })}
      {users.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No users in the list.</p>
      )}
    </div>
  );
}
