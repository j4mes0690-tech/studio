'use client';

import { useState, useMemo, useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ClientInstruction, Project, DistributionUser, Instruction, InformationRequest, ChatMessage } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { RespondToInstruction } from './respond-to-instruction';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
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
import { Trash2, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, RefreshCw, EyeOff, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'reference' | 'project' | 'directive' | 'status' | 'date';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: ClientInstruction[];
  projects: Project[];
  distributionUsers: DistributionUser[];
  currentUser: DistributionUser;
  allSiteInstructions: Instruction[];
  allRfis: InformationRequest[];
};

export function InstructionTable({ 
  items, 
  projects, 
  distributionUsers, 
  currentUser,
  allSiteInstructions,
  allRfis
}: TableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'reference':
          valA = a.reference;
          valB = b.reference;
          break;
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'directive':
          valA = a.originalText;
          valB = b.originalText;
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'date':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortOrder, projects]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('reference')}>
              <div className="flex items-center">Ref <SortIcon column="reference" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('project')}>
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('directive')}>
              <div className="flex items-center">Directive <SortIcon column="directive" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
              <div className="flex items-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
              <div className="flex items-center">Date <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="w-[80px] text-center">Chat</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
            <InstructionRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              currentUser={currentUser}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InstructionRow({ item, projects, currentUser }: { item: ClientInstruction, projects: Project[], currentUser: DistributionUser }) {
  const project = projects.find((p) => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const isAccepted = item.status === 'accepted';
  const email = currentUser?.email.toLowerCase().trim();

  // Attention Check
  const isAttentionRequired = useMemo(() => {
    if (!item || !email || isAccepted || item.status !== 'open') return false;
    if (item.dismissedBy?.includes(email)) return false;
    return (item.recipients || []).some(e => e.toLowerCase().trim() === email);
  }, [item, email, isAccepted]);

  const handleDismissAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'client-instructions', item.id);
    updateDoc(docRef, { dismissedBy: arrayUnion(email) });
  };

  const handleReopen = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'client-instructions', item.id);
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@sitecommand.internal',
        message: `Directive REOPENED by ${currentUser.name}.`,
        createdAt: new Date().toISOString()
      };

      updateDoc(docRef, {
        status: 'open',
        messages: arrayUnion(systemMessage),
        dismissedBy: []
      }).then(() => {
        toast({ title: 'Success', description: 'Directive reopened.' });
      }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: { status: 'open' }
        }));
      });
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'client-instructions', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Record removed.' }))
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
    <TableRow 
      href={`/client-instructions/${item.id}`}
      className={cn(
          "group transition-all", 
          isAccepted && "bg-green-50/10",
          isAttentionRequired && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20"
      )}
    >
      <TableCell className="font-mono text-[10px]">
          <div className="flex items-center gap-2">
              {isAttentionRequired && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
              {item.reference}
          </div>
      </TableCell>
      <TableCell className="font-medium">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-sm" title={item.originalText}>
          {item.originalText}
        </div>
      </TableCell>
      <TableCell>
        {isAccepted ? (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-[10px]">ACCEPTED</Badge>
        ) : (
          <Badge variant="default" className="text-[10px]">OPEN</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
            <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {item.messages?.length || 0}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAttentionRequired && (
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8 hover:text-primary" onClick={handleDismissAlert}>
                              <EyeOff className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Dismiss Alert</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
          )}

          {isAccepted ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleReopen} disabled={isPending}>
                    <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Reopen Directive</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          
          <RespondToInstruction instruction={item} currentUser={currentUser} />
          
          <AlertDialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Record</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>Permanently delete this client instruction record. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                    {isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
