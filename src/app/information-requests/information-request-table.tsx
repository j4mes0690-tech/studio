'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { InformationRequest, Project, DistributionUser, ChatMessage } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { RespondToRequest } from './respond-to-request';
import { EditInformationRequest } from './edit-information-request';
import { useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { XCircle, RefreshCw, Trash2, CalendarClock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type TableProps = {
  items: InformationRequest[];
  projects: Project[];
  distributionUsers: DistributionUser[];
  currentUser: DistributionUser;
};

export function InformationRequestTable({ items, projects, distributionUsers, currentUser }: TableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Due Date</TableHead>
            <TableHead className="w-[80px] text-center">Chat</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <RequestTableRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              distributionUsers={distributionUsers} 
              currentUser={currentUser} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestTableRow({ item, projects, distributionUsers, currentUser }: { item: InformationRequest, projects: Project[], distributionUsers: DistributionUser[], currentUser: DistributionUser }) {
  const project = projects.find((p) => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const handleUpdateStatus = (newStatus: 'open' | 'closed') => {
    startTransition(async () => {
      const docRef = doc(db, 'information-requests', item.id);
      const updates: any = { 
        status: newStatus,
        dismissedBy: [] 
      };

      const systemMsg: ChatMessage = {
        id: `msg-system-${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@sitecommand.internal',
        message: newStatus === 'closed' 
          ? `Request closed by ${currentUser.name}. Thank you all for your input.`
          : `Request reopened by ${currentUser.name}`,
        createdAt: new Date().toISOString(),
      };
      updates.messages = arrayUnion(systemMsg);

      updateDoc(docRef, updates)
        .then(() => toast({ title: 'Success', description: `Request ${newStatus}.` }))
        .catch((err) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'information-requests', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Request deleted.' }))
        .catch((err) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <TableRow className={cn(item.status === 'closed' && "opacity-60")}>
      <TableCell className="font-medium">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-sm" title={item.description}>
          {item.description}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className="capitalize">
          {item.status}
        </Badge>
      </TableCell>
      <TableCell>
        {item.requiredBy ? (
          <div className="flex items-center gap-1 text-xs font-medium text-destructive">
            <CalendarClock className="h-3 w-3" />
            <ClientDate date={item.requiredBy} format="date" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {item.messages?.length || 0}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {item.status === 'open' ? (
            <>
              <RespondToRequest item={item} distributionUsers={distributionUsers} currentUser={currentUser} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('closed')} disabled={isPending}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Close Request</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => handleUpdateStatus('open')} disabled={isPending}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Reopen Request</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <EditInformationRequest item={item} projects={projects} distributionUsers={distributionUsers} />
          
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Request</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>Permanently delete this information request. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
