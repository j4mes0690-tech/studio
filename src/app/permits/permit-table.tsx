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
import { useState, useTransition } from 'react';
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
  ExternalLink
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
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-[150px]">Contractor</TableHead>
            <TableHead className="w-[150px]">Location</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[150px]">Valid Until</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permits.map((permit) => (
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
            
            <EditPermitDialog 
              permit={permit} 
              projects={projects} 
              subContractors={subContractors} 
              allPermits={allPermits}
              currentUser={currentUser}
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />

            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
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
