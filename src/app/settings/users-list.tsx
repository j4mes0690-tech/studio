
'use client';

import type { DistributionUser, Invitation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, Clock, CheckCircle2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTransition, useMemo } from 'react';
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function UsersList({ users }: { users: DistributionUser[] }) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();
  const { toast } = useToast();

  const invitationsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'invitations');
  }, [db]);
  const { data: allInvitations } = useCollection<Invitation>(invitationsQuery);

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
    <div className="space-y-3">
      {users.map((user) => {
        const isPendingOnboarding = allInvitations?.some(i => 
            i.email.toLowerCase() === user.email.toLowerCase() && 
            i.status === 'pending'
        );
        
        const isAdmin = user.permissions && (user.permissions.hasFullVisibility || Object.entries(user.permissions).some(([k,v]) => k.startsWith('canManage') && v === true));

        return (
          <div key={user.id || user.email} className={cn(
            "flex items-center justify-between p-4 rounded-xl border bg-card transition-all hover:border-primary/30 group shadow-sm",
            isPendingOnboarding && "border-dashed opacity-80"
          )}>
            <div className="flex items-center gap-4 min-w-0">
                <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isPendingOnboarding ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                )}>
                    {isPendingOnboarding ? <Clock className="h-5 w-5" /> : user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{user.name}</p>
                        {isPendingOnboarding && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200 gap-1 px-1.5 font-black uppercase tracking-tighter">
                                            PENDING
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Awaiting onboarding completion</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {!isPendingOnboarding && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-green-50 text-green-700 border-green-200 gap-1 px-1.5 font-black uppercase tracking-tighter">
                                VERIFIED
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        <span className="truncate">{user.email}</span>
                        {isAdmin && (
                            <span className="flex items-center gap-1 text-primary font-bold">
                                <ShieldCheck className="h-3 w-3" />
                                Admin
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1">
              <EditUserForm user={user} />
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                      <AlertDialogTitle>Remove User Profile?</AlertDialogTitle>
                      <AlertDialogDescription>
                          This will permanently delete the access profile for {user.name}. The associated Firebase Authentication account will remain until manually removed.
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
          <p className="text-muted-foreground text-center py-12 text-sm italic border-2 border-dashed rounded-lg">No users found in directory.</p>
      )}
    </div>
  );
}
