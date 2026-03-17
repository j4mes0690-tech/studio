
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
import type { SiteDiaryEntry, Project } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Loader2, Cloud, Users, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type SortKey = 'date' | 'project' | 'resources' | 'weather';
type SortOrder = 'asc' | 'desc';

export function DiaryTable({ 
  entries, 
  projects 
}: { 
  entries: SiteDiaryEntry[]; 
  projects: Project[]; 
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'date':
          valA = a.date;
          valB = b.date;
          break;
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'resources':
          valA = a.subcontractorLogs.reduce((sum, l) => sum + (l.operativeCount || (l as any).employeeCount || 0), 0);
          valB = b.subcontractorLogs.reduce((sum, l) => sum + (l.operativeCount || (l as any).employeeCount || 0), 0);
          break;
        case 'weather':
          valA = a.weather.condition;
          valB = b.weather.condition;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [entries, sortKey, sortOrder, projects]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px] cursor-pointer" onClick={() => handleSort('date')}>
              <div className="flex items-center">Date <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="w-[200px] cursor-pointer" onClick={() => handleSort('project')}>
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer" onClick={() => handleSort('weather')}>
              <div className="flex items-center">Weather <SortIcon column="weather" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer text-center" onClick={() => handleSort('resources')}>
              <div className="flex items-center justify-center">Workforce <SortIcon column="resources" /></div>
            </TableHead>
            <TableHead>Activity Highlight</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.map((entry) => (
            <DiaryRow 
              key={entry.id} 
              entry={entry} 
              project={projects.find(p => p.id === entry.projectId)} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DiaryRow({ entry, project }: { entry: SiteDiaryEntry, project?: Project }) {
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const totalPersonnel = entry.subcontractorLogs.reduce((sum, log) => sum + (log.operativeCount || (log as any).employeeCount || 0), 0);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'site-diary', entry.id));
    });
  };

  return (
    <TableRow>
      <TableCell className="font-bold">
        <ClientDate date={entry.date} format="date" />
      </TableCell>
      <TableCell className="font-medium text-xs truncate max-w-[180px]">{project?.name || '---'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-xs">
            <Cloud className="h-3 w-3 text-muted-foreground" />
            {entry.weather.condition} {entry.weather.temp && `(${entry.weather.temp}°C)`}
        </div>
      </TableCell>
      <TableCell className="text-center font-bold text-primary">
        <div className="flex items-center justify-center gap-1.5">
            <Users className="h-3 w-3" />
            {totalPersonnel}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground truncate max-w-[250px]">
        {entry.generalComments || 'No activity log recorded.'}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Log?</AlertDialogTitle><AlertDialogDescription>Permanently remove the diary entry for this date.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
