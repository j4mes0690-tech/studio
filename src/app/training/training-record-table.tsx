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
import type { TrainingRecord, Photo } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useMemo, useTransition, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ShieldCheck, Clock, AlertTriangle, FileText, GraduationCap, Calendar, Download, Eye } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';

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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
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
      toast({ title: 'Success', description: 'Record removed.' });
    });
  };

  return (
    <>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
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
          </div>
        </TableCell>
      </TableRow>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle>{record.courseName}</DialogTitle>
                <DialogDescription>Verification for {record.userName}</DialogDescription>
              </div>
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

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
