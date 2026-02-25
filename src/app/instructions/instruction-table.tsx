'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Instruction, Project, DistributionUser, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { EditInstruction } from './edit-instruction';
import { DistributeInstructionButton } from './distribute-instruction-button';
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
import { Trash2, FileText, Camera, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'reference' | 'project' | 'summary' | 'recipient' | 'date';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: Instruction[];
  projects: Project[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
};

export function InstructionTable({ items, projects, distributionUsers, subContractors }: TableProps) {
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
        case 'summary':
          valA = a.summary;
          valB = b.summary;
          break;
        case 'recipient':
          const recA = a.recipients?.[0];
          const recB = b.recipients?.[0];
          valA = subContractors.find(s => s.email === recA)?.name || distributionUsers.find(u => u.email === recA)?.name || recA || '';
          valB = subContractors.find(s => s.email === recB)?.name || distributionUsers.find(u => u.email === recB)?.name || recB || '';
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
  }, [items, sortKey, sortOrder, projects, distributionUsers, subContractors]);

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
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('summary')}>
              <div className="flex items-center">Summary <SortIcon column="summary" /></div>
            </TableHead>
            <TableHead className="w-[180px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('recipient')}>
              <div className="flex items-center">Recipient <SortIcon column="recipient" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
              <div className="flex items-center">Date <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="w-[80px] text-center">Docs</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <TableRow 
      href={`/instructions/${item.id}`}
      className="group"
    >
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <DistributeInstructionButton 
            instruction={item} 
            project={project} 
            subContractors={subContractors} 
          />

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