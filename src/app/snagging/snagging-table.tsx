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
import type { SnaggingItem, Project, SubContractor, SnaggingHistoryRecord, DistributionUser } from '@/lib/types';
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
import { Trash2, CheckCircle2, MapPin, ArrowUpDown, ArrowUp, ArrowDown, History, Loader2, Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type SortKey = 'project' | 'area' | 'title' | 'date' | 'progress';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: (SnaggingItem & { isProjectAggregation?: boolean })[];
  projects: Project[];
  subContractors: SubContractor[];
  allUsers: DistributionUser[];
};

export function SnaggingTable({ items, projects, subContractors, allUsers }: TableProps) {
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
              className="hidden md:table-cell w-[150px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('project')}
            >
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead 
              className="w-[100px] md:w-[120px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('area')}
            >
              <div className="flex items-center">Location <SortIcon column="area" /></div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center">Identifier <SortIcon column="title" /></div>
            </TableHead>
            <TableHead 
              className="hidden md:table-cell w-[120px] cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('date')}
            >
              <div className="flex items-center">Latest <SortIcon column="date" /></div>
            </TableHead>
            <TableHead 
              className="w-[80px] md:w-[100px] cursor-pointer hover:text-foreground transition-colors text-right pr-4 md:pr-6"
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
              allUsers={allUsers}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SnagRow({ item, projects, subContractors, allUsers }: { item: SnaggingItem & { isProjectAggregation?: boolean }, projects: Project[], subContractors: SubContractor[], allUsers: DistributionUser[] }) {
  const router = useRouter();
  const project = projects.find((p) => p.id === item.projectId);
  const area = project?.areas?.find((a) => a.id === item.areaId);
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const isComplete = totalItems > 0 && totalItems === closedItems;

  const handleClick = () => {
    if (item.isProjectAggregation) {
        localStorage.setItem('sitecommand_grouping_snagging', 'false');
        router.push(`/snagging?project=${item.projectId}`);
    } else {
        router.push(`/snagging/${item.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const docRef = doc(db, 'snagging-items', item.id);
        await deleteDoc(docRef);
        toast({ title: 'Success', description: 'Snagging list deleted.' });
      } catch (err) {
        const permissionError = new FirestorePermissionError({
          path: `snagging-items/${item.id}`,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer hover:bg-muted/30", item.isProjectAggregation && "bg-primary/[0.03]")}
      onClick={handleClick}
    >
      <TableCell className="hidden md:table-cell font-medium text-xs">
        {item.isProjectAggregation ? (
            <div className="flex items-center gap-2 text-primary font-bold">
                <Building2 className="h-3 w-3" />
                OVERVIEW
            </div>
        ) : (
            project?.name || '---'
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
          {item.isProjectAggregation ? (
              <Badge variant="secondary" className="text-[8px] h-4 uppercase">Multiple Areas</Badge>
          ) : (
              <>
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{area?.name || 'Site'}</span>
              </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
            <span className={cn("text-xs md:text-sm font-bold group-hover:text-primary transition-colors truncate", item.isProjectAggregation && "text-primary")}>
                {item.title}
            </span>
            {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            {item.isProjectAggregation && <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-all" />}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
            <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-right pr-4 md:pr-6">
        <Badge variant={isComplete ? "secondary" : "outline"} className={cn("text-[10px] h-5 px-1.5", isComplete && "bg-green-100 text-green-800 border-green-200")}>
            {closedItems}/{totalItems}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <div className='flex items-center gap-1'>
            <PdfReportButton item={item} project={project} subContractors={subContractors} />
            <DistributeReportsButton item={item} project={project} subContractors={subContractors} allUsers={allUsers} />
          </div>
          
          {!item.isProjectAggregation && (
            <AlertDialog>
                <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Entire List</p></TooltipContent>
                </Tooltip>
                </TooltipProvider>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Snagging List?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the list "{item.title}" and all its recorded defects. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
