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
import type { SnaggingItem, Project, SubContractor, SnaggingHistoryRecord } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { PdfReportButton } from './pdf-report-button';
import { DistributeReportsButton } from './distribute-reports-button';
import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, deleteDoc, collection } from 'firebase/firestore';
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
import { Trash2, CheckCircle2, MapPin, ArrowUpDown, ArrowUp, ArrowDown, History } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'project' | 'area' | 'title' | 'date' | 'progress' | 'snapshots';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: SnaggingItem[];
  projects: Project[];
  subContractors: SubContractor[];
};

export function SnaggingTable({ items, projects, subContractors }: TableProps) {
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
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'area':
          const projA = projects.find(p => p.id === a.projectId);
          const projB = projects.find(p => p.id === b.projectId);
          valA = projA?.areas?.find(ar => ar.id === a.areaId)?.name || 'General Site';
          valB = projB?.areas?.find(ar => ar.id === b.areaId)?.name || 'General Site';
          break;
        case 'title':
          valA = a.title;
          valB = b.title;
          break;
        case 'date':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'progress':
          const closedA = a.items?.filter(i => i.status === 'closed').length || 0;
          const totalA = a.items?.length || 1;
          const closedB = b.items?.filter(i => i.status === 'closed').length || 0;
          const totalB = b.items?.length || 1;
          valA = closedA / totalA;
          valB = closedB / totalB;
          break;
        default:
          return 0;
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
            <TableHead 
              className="w-[150px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('project')}
            >
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead 
              className="w-[120px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('area')}
            >
              <div className="flex items-center">Area <SortIcon column="area" /></div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center">List Title <SortIcon column="title" /></div>
            </TableHead>
            <TableHead 
              className="w-[120px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center">Date <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="w-[100px] text-center">Snapshots</TableHead>
            <TableHead 
              className="w-[100px] cursor-pointer hover:text-foreground transition-colors text-right pr-6"
              onClick={() => handleSort('progress')}
            >
              <div className="flex items-center justify-end">Progress <SortIcon column="progress" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
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
  const area = project?.areas?.find((a) => a.id === item.areaId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  // Fetch Snapshot Count for this specific list
  const historyQuery = useMemoFirebase(() => {
    if (!db || !item.id) return null;
    return collection(db, 'snagging-items', item.id, 'history');
  }, [db, item.id]);
  const { data: history } = useCollection<SnaggingHistoryRecord>(historyQuery);

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
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
    <TableRow 
      className={cn("group cursor-pointer", isComplete && "opacity-60")}
      href={`/snagging/${item.id}`}
    >
      <TableCell className="font-medium">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{area?.name || 'General Site'}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.title}</span>
            {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
            <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="text-[10px] gap-1 font-mono">
          <History className="h-2.5 w-2.5" />
          {history?.length || 0}
        </Badge>
      </TableCell>
      <TableCell className="text-right pr-6">
        <Badge variant={isComplete ? "secondary" : "outline"} className="text-[10px]">
            {closedItems}/{totalItems}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <PdfReportButton item={item} project={project} subContractors={subContractors} />
          <DistributeReportsButton item={item} project={project} subContractors={subContractors} />
          
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