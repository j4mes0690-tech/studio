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
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { EditSnaggingItem } from './edit-snagging-item';
import { PdfReportButton } from './pdf-report-button';
import { DistributeReportsButton } from './distribute-reports-button';
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
import { Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TableProps = {
  items: SnaggingItem[];
  projects: Project[];
  subContractors: SubContractor[];
};

export function SnaggingTable({ items, projects, subContractors }: TableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead>List Title</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="w-[100px]">Progress</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <SnagRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              subContractors={subContractors}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SnagRow({ item, projects, subContractors }: { item: SnaggingItem, projects: Project[], subContractors: SubContractor[] }) {
  const project = projects.find((p) => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'snagging-items', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Snagging list deleted.' }))
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
    <TableRow className={cn(isComplete && "opacity-60")}>
      <TableCell className="font-medium">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.title}</span>
            {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
            <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={isComplete ? "secondary" : "outline"} className="text-[10px]">
            {closedItems}/{totalItems}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <PdfReportButton item={item} project={project} subContractors={subContractors} />
          <DistributeReportsButton item={item} project={project} subContractors={subContractors} />
          <EditSnaggingItem item={item} projects={projects} subContractors={subContractors} />
          
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
                <TooltipContent><p>Delete List</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>Permanently delete this entire snagging list. This cannot be undone.</AlertDialogDescription>
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
