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
import type { Permit, Project, SubContractor, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, 
  CheckCircle2, 
  Loader2, 
  FileDown,
  XCircle,
  Clock,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EditPermitDialog } from './edit-permit';

type SortKey = 'reference' | 'type' | 'contractor' | 'location' | 'status' | 'validTo';
type SortOrder = 'asc' | 'desc';

export function PermitTable({ 
  permits, 
  projects, 
  subContractors,
  allPermits,
  currentUser
}: { 
  permits: Permit[]; 
  projects: Project[]; 
  subContractors: SubContractor[];
  allPermits: Permit[];
  currentUser: DistributionUser;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('reference');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedPermits = useMemo(() => {
    return [...permits].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'reference':
          valA = a.reference;
          valB = b.reference;
          break;
        case 'type':
          valA = a.type;
          valB = b.type;
          break;
        case 'contractor':
          valA = a.contractorName;
          valB = b.contractorName;
          break;
        case 'location':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        case 'validTo':
          valA = new Date(a.validTo).getTime();
          valB = new Date(b.validTo).getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [permits, sortKey, sortOrder, projects]);

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
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('type')}>
              <div className="flex items-center">Type <SortIcon column="type" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('contractor')}>
              <div className="flex items-center">Contractor <SortIcon column="contractor" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('location')}>
              <div className="flex items-center">Location <SortIcon column="location" /></div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
              <div className="flex items-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('validTo')}>
              <div className="flex items-center">Valid Until <SortIcon column="validTo" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPermits.map((permit) => (
            <PermitTableRow 
              key={permit.id} 
              permit={permit} 
              projects={projects} 
              subContractors={subContractors} 
              allPermits={allPermits}
              currentUser={currentUser}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PermitTableRow({ 
  permit, 
  projects, 
  subContractors,
  allPermits,
  currentUser
}: { 
  permit: Permit; 
  projects: Project[]; 
  subContractors: SubContractor[];
  allPermits: Permit[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === permit.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = permit.status === 'draft';
  const isClosed = permit.status === 'closed';
  const isExpired = !isClosed && new Date(permit.validTo) < new Date();

  const handleIssue = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'permits', permit.id);
      await updateDoc(docRef, { status: 'issued' });
      toast({ title: 'Success', description: 'Permit issued.' });
    });
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'permits', permit.id);
      await updateDoc(docRef, { 
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedByEmail: currentUser.email
      });
      toast({ title: 'Success', description: 'Permit closed.' });
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'permits', permit.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Permit removed.' });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", isClosed && "opacity-60", isDraft && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">{permit.reference}</TableCell>
      <TableCell className="font-medium">{permit.type}</TableCell>
      <TableCell className="truncate max-w-[150px] text-xs">{permit.contractorName}</TableCell>
      <TableCell className="truncate max-w-[150px] text-muted-foreground text-xs">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        {isDraft ? (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">DRAFT</Badge>
        ) : isClosed ? (
          <Badge variant="outline" className="text-[10px]">CLOSED</Badge>
        ) : (
          <Badge variant="outline" className={cn("text-[10px]", isExpired ? "text-destructive border-destructive/20" : "text-green-600 border-green-200")}>
              {isExpired ? 'EXPIRED' : 'ACTIVE'}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className={cn("flex items-center gap-1 text-[11px]", isExpired && !isClosed && "text-destructive font-bold")}>
          <Clock className="h-3 w-3" />
          <ClientDate date={permit.validTo} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <TooltipProvider>
            {isDraft && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleIssue} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="sr-only">Issue Permit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Issue Permit</p></TooltipContent>
              </Tooltip>
            )}

            {!isDraft && !isClosed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handleClose} disabled={isPending}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Close Permit</p></TooltipContent>
              </Tooltip>
            )}
            
            <TableCell className="p-0 border-0 flex items-center justify-center">
              <EditPermitDialog 
                permit={permit} 
                projects={projects} 
                subContractors={subContractors} 
                allPermits={allPermits}
                currentUser={currentUser}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              />
            </TableCell>

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
                  <TooltipContent><p>Delete Permit</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This will remove permit audit trail for {permit.reference}.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}
