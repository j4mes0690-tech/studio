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
import type { Instruction, Project, DistributionUser, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { EditInstruction } from './edit-instruction';
import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
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
import { Trash2, FileText, Camera } from 'lucide-react';

type TableProps = {
  items: Instruction[];
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
};

export function InstructionTable({ items, projects, distributionUsers, subContractors }: TableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead className="w-[180px]">Recipient</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="w-[80px] text-center">Docs</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <InstructionRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              distributionUsers={distributionUsers}
              subContractors={subContractors}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InstructionRow({ item, projects, distributionUsers, subContractors }: { item: Instruction, projects: Project[], distributionUsers: DistributionUser[], subContractors: SubContractor[] }) {
  const project = projects.find((p) => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isDeleting, startDeleteTransition] = useTransition();

  const recipientEmail = item.recipients?.[0];
  const recipient = subContractors.find(s => s.email === recipientEmail) || distributionUsers.find(u => u.email === recipientEmail);

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const docRef = doc(db, 'instructions', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Instruction deleted.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
      <TableCell className="font-medium">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-sm" title={item.summary}>
          {item.summary}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
            <span className="text-xs truncate">{recipient?.name || recipientEmail || 'Unassigned'}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
            <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          {item.photos && item.photos.length > 0 && <Camera className="h-3 w-3" />}
          {item.files && item.files.length > 0 && <FileText className="h-3 w-3" />}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <EditInstruction 
            item={item} 
            projects={projects} 
            distributionUsers={distributionUsers} 
            subContractors={subContractors} 
          />
          
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
                <TooltipContent><p>Delete Instruction</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>Permanently delete this site instruction record.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
