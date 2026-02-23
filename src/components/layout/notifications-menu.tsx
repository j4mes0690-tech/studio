'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, HelpCircle, Loader2, MessageSquareReply } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, or, and, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function NotificationsMenu({ userEmail }: { userEmail: string }) {
  const db = useFirestore();
  const normalizedEmail = userEmail.toLowerCase().trim();

  // Fetch current user profile for admin check
  const profileRef = useMemo(() => {
    if (!db || !normalizedEmail) return null;
    return doc(db, 'users', normalizedEmail);
  }, [db, normalizedEmail]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  // Fetch projects to determine authorized project IDs
  const projectsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const allowedProjectIds = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.canManageProjects) return allProjects.map(p => p.id);
    return allProjects
      .filter(p => p.assignedUsers?.includes(normalizedEmail))
      .map(p => p.id);
  }, [allProjects, profile, normalizedEmail]);

  // Query for open requests that involve the current user
  const notificationsQuery = useMemo(() => {
    if (!db || !normalizedEmail) return null;
    return query(
      collection(db, 'information-requests'),
      and(
        where('status', '==', 'open'),
        or(
          where('assignedTo', 'array-contains', normalizedEmail),
          where('raisedBy', '==', normalizedEmail)
        )
      )
    );
  }, [db, normalizedEmail]);

  const { data: rawRequests, isLoading } = useCollection<InformationRequest>(notificationsQuery);

  const notifications = useMemo(() => {
    if (!rawRequests || !profile) return [];

    return rawRequests.map(request => {
      // 0. Verify Project Assignment
      if (!allowedProjectIds.includes(request.projectId)) return null;

      // 1. Skip if user has dismissed this specific notification
      if (request.dismissedBy?.includes(normalizedEmail)) return null;

      // 2. Check if assigned to user
      const isAssignedToMe = request.assignedTo.includes(normalizedEmail);
      
      // 3. Check if raised by user and has response from someone else
      const messages = request.messages || [];
      const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
      const isMyRaisedWithResponse = request.raisedBy === normalizedEmail && lastMessage && lastMessage.senderEmail !== normalizedEmail;

      if (isAssignedToMe || isMyRaisedWithResponse) {
          return {
              ...request,
              notifType: isAssignedToMe ? 'assignment' : 'response',
              label: isAssignedToMe ? 'Assigned to you' : 'New response received'
          };
      }
      return null;
    }).filter(Boolean);
  }, [rawRequests, normalizedEmail, allowedProjectIds, profile]);

  const handleDismiss = (requestId: string) => {
    const docRef = doc(db, 'information-requests', requestId);
    updateDoc(docRef, {
      dismissedBy: arrayUnion(normalizedEmail)
    }).catch(error => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { dismissedBy: normalizedEmail }
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const pendingCount = notifications.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] border-2 border-background animate-pulse"
            >
              {pendingCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Pending Actions</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {pendingCount} Updates
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingCount === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No pending actions found.</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="p-1 space-y-1">
              {notifications.map((notif: any) => (
                <DropdownMenuItem 
                  key={notif.id} 
                  asChild 
                  className="cursor-pointer p-3"
                  onClick={() => handleDismiss(notif.id)}
                >
                  <Link href={`/information-requests?project=${notif.projectId}`}>
                    <div className="flex gap-3 items-start">
                      <div className={`mt-1 p-2 rounded-full ${notif.notifType === 'assignment' ? 'bg-primary/10' : 'bg-accent/10'}`}>
                        {notif.notifType === 'assignment' ? (
                            <HelpCircle className="h-4 w-4 text-primary" />
                        ) : (
                            <MessageSquareReply className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <div className="flex justify-between items-center gap-2">
                             <p className="text-xs font-semibold text-muted-foreground uppercase">{notif.label}</p>
                        </div>
                        <p className="text-sm font-medium leading-tight line-clamp-2">
                          {notif.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {notif.requiredBy ? `Due ${new Date(notif.requiredBy).toLocaleDateString()}` : 'No deadline'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer text-center justify-center font-semibold">
          <Link href="/information-requests">View All Requests</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
