'use client';

import { useState, useMemo, useTransition } from 'react';
import type { TrainingRecord, Photo, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  AlertTriangle,
  FileText,
  Maximize2,
  Download,
  Eye,
  ExternalLink,
  Pencil,
  GraduationCap,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function TrainingRecordCard({ 
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
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isArchived = !!record.archived;

  const status = useMemo(() => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(record.expiryDate));
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle };
    if (daysUntil <= 90) return { label: 'Expiring', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
    return { label: 'Active', color: 'bg-green-100 text-green-800 border-green-200', icon: ShieldCheck };
  }, [record.expiryDate]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'training-records', record.id));
      toast({ title: 'Success', description: 'Certificate record removed.' });
    });
  };

  const handleToggleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
        try {
            await updateDoc(doc(db, 'training-records', record.id), {
                archived: !isArchived
            });
            toast({ 
                title: isArchived ? 'Record Restored' : 'Record Archived', 
                description: isArchived ? 'Certification moved back to active registry.' : 'Certification moved to historical archives.' 
            });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to update archive status.', variant: 'destructive' });
        }
    });
  };

  return (
    <>
      <Card 
        className={cn(
          "group transition-all hover:border-primary cursor-pointer h-full flex flex-col",
          status.label === 'Expired' && !isArchived && "border-red-200 bg-red-50/5",
          status.label === 'Expiring' && !isArchived && "border-amber-200 bg-amber-50/5",
          isArchived && "opacity-75 grayscale border-muted bg-muted/5"
        )}
        onClick={() => setIsDetailOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isArchived ? (
                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-tighter h-5 bg-slate-200 text-slate-700">
                        <Archive className="h-2.5 w-2.5 mr-1" /> Archived
                    </Badge>
                ) : (
                    <Badge variant="outline" className={cn("text-[10px] font-bold h-5", status.color)}>
                        <status.icon className="h-2.5 w-2.5 mr-1" />
                        {status.label}
                    </Badge>
                )}
              </div>
              <CardTitle className="text-lg leading-tight pt-1 group-hover:text-primary transition-colors">{record.courseName}</CardTitle>
              <CardDescription className="font-bold text-foreground text-xs uppercase tracking-tight">
                {record.userName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary" 
                            onClick={handleToggleArchive}
                            disabled={isPending}
                        >
                            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isArchived ? 'Restore to Registry' : 'Archive Record'}</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary" 
                            onClick={() => setIsEditOpen(true)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Edit Details</p></TooltipContent>
                </Tooltip>

                <AlertDialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete Permanently</p></TooltipContent>
                    </Tooltip>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Training Record?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove the certification data for {record.userName}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
            <div className="space-y-1">
              <p className="font-bold text-muted-foreground uppercase tracking-widest">Issued</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> <ClientDate date={record.issueDate} format="date" /></p>
            </div>
            <div className="space-y-1 text-right">
              <p className="font-bold text-muted-foreground uppercase tracking-widest">Expiry</p>
              <p className={cn("font-bold flex items-center justify-end gap-1", status.label !== 'Active' && !isArchived && "text-destructive")}>
                <Clock className="h-3 w-3" /> <ClientDate date={record.expiryDate} format="date" />
              </p>
            </div>
          </div>

          {record.certificateNumber && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>Cert No: <strong>{record.certificateNumber}</strong></span>
            </div>
          )}

          {record.photos && record.photos.length > 0 && (
            <div className="flex gap-2 pt-2">
              {record.photos.slice(0, 3).map((p, i) => (
                <div key={i} className="relative w-10 h-10 rounded border bg-muted">
                  <Image src={p.url} alt="Cert" fill className="object-cover opacity-60" />
                </div>
              ))}
              {record.photos.length > 3 && (
                <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  +{record.photos.length - 3}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="truncate">{record.courseName}</DialogTitle>
                <DialogDescription>Professional qualification for {record.userName}</DialogDescription>
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
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Certificate Number</Label>
                <p className="text-sm font-mono">{record.certificateNumber || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Compliance Status</Label>
                <div className="pt-1">
                  <Badge className={cn("text-[9px] font-black h-5 uppercase", status.color)}>{status.label}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Certificate Evidence</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {record.photos?.map((photo, idx) => (
                  <div key={idx} className="relative aspect-[1.4/1] rounded-xl border-2 border-muted overflow-hidden group shadow-sm">
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
                    <p className="text-xs text-muted-foreground">No digital certificate uploaded.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className="font-bold" onClick={() => setIsDetailOpen(false)}>Close Registry</Button>
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

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
