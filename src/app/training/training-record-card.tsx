'use client';

import { useState, useMemo, useTransition } from 'react';
import type { TrainingRecord, Photo } from '@/lib/types';
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
  Maximize2
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
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
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';

export function TrainingRecordCard({ record }: { record: TrainingRecord }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const status = useMemo(() => {
    const today = startOfDay(new Date());
    const expiry = startOfDay(parseISO(record.expiryDate));
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) return { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle };
    if (daysUntil <= 90) return { label: 'Expiring Soon', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
    return { label: 'Active', color: 'bg-green-100 text-green-800 border-green-200', icon: ShieldCheck };
  }, [record.expiryDate]);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'training-records', record.id));
      toast({ title: 'Success', description: 'Certificate record removed.' });
    });
  };

  return (
    <>
      <Card className={cn(
        "group transition-all hover:border-primary",
        status.label === 'Expired' && "border-red-200 bg-red-50/5",
        status.label === 'Expiring Soon' && "border-amber-200 bg-amber-50/5"
      )}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <Badge variant="outline" className={cn("text-[10px] font-bold h-5", status.color)}>
                <status.icon className="h-2.5 w-2.5 mr-1" />
                {status.label}
              </Badge>
              <CardTitle className="text-lg leading-tight pt-1">{record.courseName}</CardTitle>
              <CardDescription className="font-bold text-foreground text-xs uppercase tracking-tight">
                {record.userName}
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
            <div className="space-y-1">
              <p className="font-bold text-muted-foreground uppercase tracking-widest">Issued</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> <ClientDate date={record.issueDate} format="date" /></p>
            </div>
            <div className="space-y-1 text-right">
              <p className="font-bold text-muted-foreground uppercase tracking-widest">Expiry</p>
              <p className={cn("font-bold flex items-center justify-end gap-1", status.label !== 'Active' && "text-destructive")}>
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
              {record.photos.map((p, i) => (
                <div 
                    key={i} 
                    className="relative w-12 h-12 rounded border overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group/img"
                    onClick={() => setViewingPhoto(p)}
                >
                  <Image src={p.url} alt="Cert scan" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                    <Maximize2 className="h-3 w-3 text-white" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
