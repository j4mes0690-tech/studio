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
import type { TrainingRecord } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useMemo, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ShieldCheck, Clock, AlertTriangle, FileText } from 'lucide-react';
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
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export function TrainingRecordTable({ records }: { records: TrainingRecord[] }) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Qualification</TableHead>
            <TableHead>Cert No.</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TrainingRow key={record.id} record={record} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TrainingRow({ record }: { record: TrainingRecord }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const status = useMemo(() => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(record.expiryDate));
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    if (daysUntil <= 90) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-800', icon: Clock };
    return { label: 'Active', color: 'bg-green-100 text-green-800', icon: ShieldCheck };
  }, [record.expiryDate]);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'training-records', record.id));
      toast({ title: 'Success', description: 'Record removed.' });
    });
  };

  return (
    <TableRow className={cn(status.label === 'Expired' && "bg-red-50/10")}>
      <TableCell className="font-bold">{record.userName}</TableCell>
      <TableCell className="font-medium">{record.courseName}</TableCell>
      <TableCell className="font-mono text-[10px] text-muted-foreground">{record.certificateNumber || 'N/A'}</TableCell>
      <TableCell>
        <div className={cn("flex items-center gap-1.5 text-xs font-bold", status.label !== 'Active' && "text-destructive")}>
          <Clock className="h-3 w-3" />
          <ClientDate date={record.expiryDate} format="date" />
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-[9px] uppercase font-black tracking-tighter border-transparent h-5", status.color)}>
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Permanently delete this certificate record?</AlertDialogDescription></AlertDialogHeader>
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
