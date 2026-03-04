'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, HelpCircle, Loader2, MessageSquareReply, X, Check, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, or, and, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import type { InformationRequest, Project, DistributionUser, ClientInstruction } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ClientDate } from '@/components/client-date';

export function NotificationsMenu({ userEmail }: { userEmail: string | null | undefined }) {
  const db = useFirestore();
  const router = useRouter();
  const normalizedEmail = userEmail?.toLowerCase().trim() || '';
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Fetch current user profile for permission check
  const profileRef = useMemoFirebase(() => {
    if (!db || !normalizedEmail) return null;
    return doc(db, 'users', normalizedEmail);
  }, [db, normalizedEmail]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  // Fetch projects to determine authorized project IDs
  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const allowedProjectIds = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects.map(p => p.id);
    return allProjects
      .filter(p => (p.assignedUsers || []).some(email => email.toLowerCase().trim() === normalizedEmail))
      .map(p => p.id);
  }, [allProjects, profile, normalizedEmail]);

  // Query 1: Open Information Requests (RFIs)
  const rfiQuery = useMemoFirebase(() => {
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
  const { data: rawRequests, isLoading: rfiLoading } = useCollection<InformationRequest>(rfiQuery);

  // Query 2: Open Client Instructions (CIs)
  const ciQuery = useMemoFirebase(() => {
    if (!db || !normalizedEmail) return null;
    return query(
      collection(db, 'client-instructions'),
      where('status', '==', 'open')
    );
  }, [db, normalizedEmail]);
  const { data: rawClientInstructions, isLoading: ciLoading } = useCollection<ClientInstruction>(ciQuery);

  const notifications = useMemo(() => {
    if (!profile || !normalizedEmail) return [];

    const list: any[] = [];

    // Process RFIs
    if (rawRequests) {
      rawRequests.forEach(request => {
        if (!allowedProjectIds.includes(request.projectId)) return;
        if (request.dismissedBy?.includes(normalizedEmail)) return;

        const isAssignedToMe = request.assignedTo.some(e => e.toLowerCase().trim() === normalizedEmail);
        const messages = request.messages || [];
        const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        const isMyRaisedWithResponse = request.raisedBy.toLowerCase().trim() === normalizedEmail && lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== normalizedEmail;

        if (isAssignedToMe || isMyRaisedWithResponse) {
          list.push({
            id: request.id,
            collection: 'information-requests',
            projectId: request.projectId,
            description: request.description,
            notifType: isAssignedToMe ? 'assignment' : 'response',
            label: isAssignedToMe ? 'RFI Assigned to you' : 'New RFI response',
            createdAt: lastMessage ? lastMessage.createdAt : request.createdAt,
            url: `/information-requests/${request.id}`
          });
        }
      });
    }

    // Process Client Instructions
    if (rawClientInstructions) {
      rawClientInstructions.forEach(ci => {
        if (!allowedProjectIds.includes(ci.projectId)) return;
        if (ci.dismissedBy?.includes(normalizedEmail)) return;

        // Everyone assigned to the project is a recipient
        const isRecipient = (ci.recipients || []).some(e => e.toLowerCase().trim() === normalizedEmail);
        const messages = ci.messages || [];
        const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        
        // Notify if it's a new instruction or if someone else has commented
        const hasExternalUpdate = lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== normalizedEmail;

        if (isRecipient) {
          list.push({
            id: ci.id,
            collection: 'client-instructions',
            projectId: ci.projectId,
            description: ci.originalText,
            notifType: hasExternalUpdate ? 'response' : 'assignment',
            label: hasExternalUpdate ? 'New directive update' : 'New Client Directive',
            createdAt: lastMessage ? lastMessage.createdAt : ci.createdAt,
            url: `/client-instructions/${ci.id}`
          });
        }
      });
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rawRequests, rawClientInstructions, normalizedEmail, allowedProjectIds, profile]);

  const handleDismiss = (e: React.MouseEvent, id: string, coll: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!normalizedEmail) return;

    const docRef = doc(db, coll, id);
    updateDoc(docRef, {
      dismissedBy: arrayUnion(normalizedEmail)
    }).catch(error => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: { dismissedBy: normalizedEmail }
      }));
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
        const docRef = doc(db, notif.collection, notif.id);
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
  const isLoading = rfiLoading || ciLoading;

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
                  onSelect={() => router.push(notif.url)}
                  className="cursor-pointer p-3 relative group focus:bg-muted/50 flex gap-3 items-start pr-8"
                >
                  <div className={cn(
                    "mt-1 p-2 rounded-full shrink-0",
                    notif.notifType === 'assignment' ? 'bg-primary/10' : 'bg-accent/10'
                  )}>
                    {notif.collection === 'client-instructions' ? (
                        <MessageCircle className={cn("h-4 w-4", notif.notifType === 'assignment' ? 'text-primary' : 'text-accent')} />
                    ) : (
                        notif.notifType === 'assignment' ? <HelpCircle className="h-4 w-4 text-primary" /> : <MessageSquareReply className="h-4 w-4 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none">{notif.label}</p>
                    <p className="text-sm font-medium leading-tight line-clamp-2">
                      {notif.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <ClientDate date={notif.createdAt} />
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background hover:text-destructive z-10"
                    onClick={(e) => handleDismiss(e, notif.id, notif.collection)}
                    title="Clear Notification"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </div>
          </ScrollArea>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/')} className="cursor-pointer text-center justify-center font-bold text-xs uppercase tracking-widest text-primary">
          Return to Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
