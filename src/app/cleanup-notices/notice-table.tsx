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
import type { CleanUpNotice, Project, SubContractor, Photo, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
import { Trash2, CheckCircle2, Loader2, Camera, Users, ArrowUpDown, ArrowUp, ArrowDown, MapPin, ListChecks, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditCleanUpNotice } from './edit-notice';
import { sendCleanUpNoticeEmailAction } from './actions';
import { Progress } from '@/components/ui/progress';
import { DistributeNoticeButton } from './distribute-notice-button';

type SortKey = 'reference' | 'project' | 'title' | 'date' | 'status';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: CleanUpNotice[];
  projects: Project[];
  subContractors: SubContractor[];
  allUsers: DistributionUser[];
};

export function NoticeTable({ items, projects, subContractors, allUsers }: TableProps) {
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
          valA = a.reference || '';
          valB = b.reference || '';
          break;
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'title':
          valA = a.title || '';
          valB = b.title || '';
          break;
        case 'date':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'status':
          valA = a.status || 'draft';
          valB = b.status || 'draft';
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
            <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort('reference')}>
              <div className="flex items-center">Ref <SortIcon column="reference" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer" onClick={() => handleSort('project')}>
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>
              <div className="flex items-center">List Title <SortIcon column="title" /></div>
            </TableHead>
            <TableHead className="w-[150px]">Progress</TableHead>
            <TableHead className="w-[100px] cursor-pointer text-center" onClick={() => handleSort('status')}>
              <div className="flex items-center justify-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort('date')}>
              <div className="flex items-center">Logged <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
            <NoticeRow 
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

function NoticeRow({ item, projects, subContractors, allUsers }: { item: CleanUpNotice, projects: Project[], subContractors: SubContractor[], allUsers: DistributionUser[] }) {
  const project = projects.find((p) => p.id === item.projectId);
  const area = project?.areas?.find(a => a.id === item.areaId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const totalItems = item.items?.length || 0;
  const closedItems = item.items?.filter(i => i.status === 'closed').length || 0;
  const progress = totalItems > 0 ? (closedItems / totalItems) * 100 : 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'cleanup-notices', item.id));
      toast({ title: 'Deleted', description: 'Notice removed.' });
    });
  };

  const handleIssue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalItems === 0) {
      toast({ title: "Error", description: "Notice is empty.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      await updateDoc(doc(db, 'cleanup-notices', item.id), { status: 'issued' });
      toast({ title: 'Issued', description: 'Notice updated.' });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", item.status === 'draft' && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
      <TableCell className="font-medium truncate max-w-[150px]">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="flex flex-col">
            <span className="font-bold text-sm truncate max-w-[250px]">{item.title}</span>
            {area && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-2 w-2" /> {area.name}</span>}
        </div>
      </TableCell>
      <TableCell>
          <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={progress} className="h-1.5" />
              <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{closedItems}/{totalItems}</span>
          </div>
      </TableCell>
      <TableCell className="text-center">
        {item.status === 'draft' ? (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[9px] font-black">DRAFT</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] uppercase font-black bg-green-50 text-green-700 border-green-200">ISSUED</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {item.status === 'draft' ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={handleIssue} disabled={isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Issue Notice</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DistributeNoticeButton 
              notice={item} 
              project={project} 
              subContractors={subContractors} 
              allUsers={allUsers} 
            />
          )}

          <EditCleanUpNotice notice={item} projects={projects} subContractors={subContractors} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader><AlertDialogTitle>Delete Notice?</AlertDialogTitle><AlertDialogDescription>Permanently remove this requirement list.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
