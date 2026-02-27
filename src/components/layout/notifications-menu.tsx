'use client';

import React, { useMemo, useState } from 'react';
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
import { Bell, HelpCircle, Loader2, MessageSquareReply, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, or, and, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';

export function NotificationsMenu({ userEmail }: { userEmail: string | null | undefined }) {
  const db = useFirestore();
  const normalizedEmail = userEmail?.toLowerCase().trim() || '';
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Fetch current user profile for permission check
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
    
    // Global oversight restricted to hasFullVisibility. 
    if (profile.permissions?.hasFullVisibility) return allProjects.map(p => p.id);
    
    // Standard users only see notifications for projects they are assigned to
    return allProjects
      .filter(p => {
          const assignments = p.assignedUsers || [];
          return assignments.some(email => email.toLowerCase().trim() === normalizedEmail);
      })
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
    if (!rawRequests || !profile || !normalizedEmail) return [];

    return rawRequests.map(request => {
      // 0. Verify Project Assignment (Primary Security Gate)
      if (!allowedProjectIds.includes(request.projectId)) return null;

      // 1. Skip if user has dismissed this specific notification
      if (request.dismissedBy?.includes(normalizedEmail)) return null;

      // 2. Check if assigned to user
      const isAssignedToMe = request.assignedTo.some(email => email.toLowerCase().trim() === normalizedEmail);
      
      // 3. Check if raised by user and has response from someone else
      const messages = request.messages || [];
      const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
      const isMyRaisedWithResponse = request.raisedBy.toLowerCase().trim() === normalizedEmail && lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== normalizedEmail;

      if (isAssignedToMe || isMyRaisedWithResponse) {
          return {
              ...request,
              notifType: isAssignedToMe ? 'assignment' : 'response',
              label: isAssignedToMe ? 'Assigned to you' : 'New response received'
          };
      }
      return null;
    }).filter((n): n is any => n !== null);
  }, [rawRequests, normalizedEmail, allowedProjectIds, profile]);

  const handleDismiss = (e: React.MouseEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!normalizedEmail) return;

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

  const handleDismissAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (notifications.length === 0 || !normalizedEmail) return;
    
    setIsClearingAll(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        const docRef = doc(db, 'information-requests', notif.id);
        batch.update(docRef, {
          dismissedBy: arrayUnion(normalizedEmail)
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    } finally {
      setIsClearingAll(false);
    }
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
          <div className="flex flex-col">
            <span>Pending Actions</span>
            {pendingCount > 0 && <span className="text-[10px] font-normal text-muted-foreground">{pendingCount} unread</span>}
          </div>
          {pendingCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] uppercase font-bold text-primary hover:text-primary hover:bg-primary/5"
              onClick={handleDismissAll}
              disabled={isClearingAll}
            >
              {isClearingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Clear All
            </Button>
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
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">You're all caught up!</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="p-1 space-y-1">
              {notifications.map((notif: any) => (
                <DropdownMenuItem 
                  key={notif.id} 
                  asChild 
                  className="cursor-pointer p-3 relative group focus:bg-muted/50"
                >
                  <div className="flex gap-3 items-start pr-8">
                    <Link href={`/information-requests?project=${notif.projectId}`} className="flex-1 flex gap-3 items-start">
                      <div className={cn(
                        "mt-1 p-2 rounded-full",
                        notif.notifType === 'assignment' ? 'bg-primary/10' : 'bg-accent/10'
                      )}>
                        {notif.notifType === 'assignment' ? (
                            <HelpCircle className="h-4 w-4 text-primary" />
                        ) : (
                            <MessageSquareReply className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">{notif.label}</p>
                        <p className="text-sm font-medium leading-tight line-clamp-2">
                          {notif.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {notif.requiredBy ? `Due ${new Date(notif.requiredBy).toLocaleDateString()}` : 'No deadline'}
                        </p>
                      </div>
                    </Link>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hover:text-destructive"
                      onClick={(e) => handleDismiss(e, notif.id)}
                      title="Clear Notification"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer text-center justify-center font-bold text-xs uppercase tracking-widest text-primary">
          <Link href="/information-requests">View Full Log</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}