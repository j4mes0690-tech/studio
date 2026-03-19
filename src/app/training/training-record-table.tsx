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
import type { TrainingRecord, Photo, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useMemo, useTransition, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ShieldCheck, Clock, AlertTriangle, FileText, GraduationCap, Calendar, Download, Eye, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { EditTrainingRecord } from './edit-training-record';

type SortKey = 'userName' | 'courseName' | 'certificateNumber' | 'expiryDate' | 'status';
type SortOrder = 'asc' | 'desc';

export function TrainingRecordTable({ 
  records, 
  users, 
  canManageAll 
}: { 
  records: TrainingRecord[];
  users: DistributionUser[];
  canManageAll: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('expiryDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'userName':
          valA = a.userName;
          valB = b.userName;
          break;
        case 'courseName':
          valA = a.courseName;
          valB = b.courseName;
          break;
        case 'certificateNumber':
          valA = a.certificateNumber || '';
          valB = b.certificateNumber || '';
          break;
        case 'expiryDate':
          valA = new Date(a.expiryDate).getTime();
          valB = new Date(b.expiryDate).getTime();
          break;
        case 'status':
          const getWeight = (r: TrainingRecord) => {
            const today = startOfDay(new Date());
            const expiry = startOfDay(parseISO(r.expiryDate));
            const days = differenceInDays(expiry, today);
            if (days < 0) return 0;
            if (days <= 90) return 1;
            return 2;
          };
          valA = getWeight(a);
          valB = getWeight(b);
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, sortKey, sortOrder]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('userName')}>
              <div className="flex items-center">Employee <SortIcon column="userName" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('courseName')}>
              <div className="flex items-center">Qualification <SortIcon column="courseName" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('certificateNumber')}>
              <div className="flex items-center">Cert No. <SortIcon column="certificateNumber" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('expiryDate')}>
              <div className="flex items-center">Expiry Date <SortIcon column="expiryDate" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
              <div className="flex items-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.map((record) => (
            <TrainingRow 
              key={record.id} 
              record={record} 
              users={users}
              canManageAll={canManageAll}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TrainingRow({ 
  record, 
  users, 
  canManageAll 
}: { 
  record: TrainingRecord;
  users: DistributionUser[];
  canManageAll: boolean;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const status = useMemo(() => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(record.expiryDate));
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    if (daysUntil <= 90) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-800', icon: Clock };
    return { label: 'Active', color: 'bg-green-100 text-green-800', icon: ShieldCheck };
  }, [record.expiryDate]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'training-records', record.id));
      toast({ title: 'Success', description: 'Certificate record removed.' });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", status.label === 'Expired' && "bg-red-50/10")}
      onClick={() => setIsDetailOpen(true)}
    >
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
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary transition-opacity" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit Record</p></TooltipContent>
            </Tooltip>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg text-primary">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="truncate">{record.courseName}</DialogTitle>
                      <DialogDescription>Verification for {record.userName}</DialogDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 font-bold h-8" onClick={() => setIsEditOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit Record
                    </Button>
                  </div>
                </DialogHeader>

                <div className="py-6 space-y-6">
                  <div className="grid grid-cols-2 gap-6 p-4 rounded-xl border bg-muted/10">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Issue Date</Label>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <ClientDate date={record.issueDate} format="date" />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Expiry Date</Label>
                      <p className={cn("text-sm font-bold flex items-center gap-2", status.label !== 'Active' ? "text-destructive" : "text-green-600")}>
                        <Clock className="h-4 w-4" />
                        <ClientDate date={record.expiryDate} format="date" />
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cert Identification</Label>
                      <p className="text-sm font-mono">{record.certificateNumber || 'No record'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">System Audit</Label>
                      <div className="pt-1">
                        <Badge variant="outline" className={cn("text-[9px] font-black h-5 uppercase border-transparent", status.color)}>{status.label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Digital Evidence</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {record.photos?.map((photo, idx) => (
                        <div key={idx} className="relative aspect-[1.4/1] rounded-xl border-2 border-muted overflow-hidden group shadow-sm bg-muted/5">
                          <Image src={photo.url} alt="Evidence" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <Button variant="secondary" size="sm" className="h-8 gap-2 font-bold" onClick={() => setViewingPhoto(photo)}>
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button variant="secondary" size="sm" asChild className="h-8 gap-2 font-bold">
                              <a href={photo.url} download={`Cert-${record.userName.replace(/\s+/g, '-')}-${idx + 1}.jpg`}>
                                <Download className="h-3.5 w-3.5" /> Download
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!record.photos || record.photos.length === 0) && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-muted/5">
                          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No certificate documentation attached.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="ghost" className="font-bold" onClick={() => setIsDetailOpen(false)}>Close Record</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <EditTrainingRecord 
              record={record} 
              users={users} 
              canManageAll={canManageAll}
              open={isEditOpen}
              onOpenChange={setIsEditOpen}
            />

            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Record</p></TooltipContent>
              </Tooltip>
              <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Permanently delete this certificate record?</AlertDialogDescription></AlertDialogHeader>
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