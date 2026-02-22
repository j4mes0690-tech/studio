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
import { Bell, HelpCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { InformationRequest } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationsMenu({ userEmail }: { userEmail: string }) {
  const db = useFirestore();

  // Query for open requests assigned to the current user
  const notificationsQuery = useMemo(() => {
    if (!db || !userEmail) return null;
    return query(
      collection(db, 'information-requests'),
      where('status', '==', 'open'),
      where('assignedTo', 'array-contains', userEmail.toLowerCase().trim())
    );
  }, [db, userEmail]);

  const { data: requests, isLoading } = useCollection<InformationRequest>(notificationsQuery);

  const pendingCount = requests?.length || 0;

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
              {pendingCount} Required
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
              {requests?.map((request) => (
                <DropdownMenuItem key={request.id} asChild className="cursor-pointer p-3">
                  <Link href={`/information-requests?project=${request.projectId}`}>
                    <div className="flex gap-3 items-start">
                      <div className="mt-1 bg-primary/10 p-2 rounded-full">
                        <HelpCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <p className="text-sm font-medium leading-none truncate">
                          {request.description}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {request.requiredBy ? `Required by ${new Date(request.requiredBy).toLocaleDateString()}` : 'No deadline set'}
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
