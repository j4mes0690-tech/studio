
'use client';

import { useState, useTransition } from 'react';
import type { SiteProgressPhoto, Project, Photo } from '@/lib/types';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Maximize2, Trash2, MapPin, Building2, User, Clock, Loader2, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
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
import { ImageLightbox } from '@/components/image-lightbox';

export function PhotoCard({ 
  photoRecord, 
  project,
}: { 
  photoRecord: SiteProgressPhoto; 
  project?: Project;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const area = project?.areas?.find(a => a.id === photoRecord.areaId);
  const primaryPhoto = photoRecord.photos?.[0];
  const photoCount = photoRecord.photos?.length || 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'site-photos', photoRecord.id));
      toast({ title: 'Record Removed', description: 'Progress documentation deleted.' });
    });
  };

  if (!primaryPhoto) return null;

  return (
    <>
      <Card 
        className="group relative overflow-hidden transition-all hover:shadow-lg border-primary/10 hover:border-primary/30 h-full flex flex-col"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted cursor-pointer" onClick={() => setViewingPhoto(primaryPhoto)}>
          <Image 
            src={primaryPhoto.url} 
            alt={photoRecord.description || 'Site Progress'} 
            fill 
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8 shadow-xl"
                          onClick={e => e.stopPropagation()}
                      >
                          <Trash2 className="h-4 w-4" />
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Remove Documentation?</AlertDialogTitle>
                          <AlertDialogDescription>Permanently delete this record and all ${photoCount} associated photos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Everything'}
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
              <Button variant="secondary" size="icon" className="h-8 w-8 shadow-xl"><Maximize2 className="h-4 w-4" /></Button>
          </div>

          <div className="absolute top-2 left-2 z-10">
              {photoCount > 1 && (
                  <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white font-black text-[9px] gap-1.5 h-5 px-2">
                      <Images className="h-3 w-3" />
                      {photoCount} PHOTOS
                  </Badge>
              )}
          </div>

          <div className="absolute bottom-2 left-2 right-2 space-y-1 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
              <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="bg-white/90 text-primary text-[8px] font-black uppercase h-4 backdrop-blur-sm">
                      <Building2 className="h-2 w-2 mr-1" />
                      {project?.name || '---'}
                  </Badge>
                  {area && (
                      <Badge variant="secondary" className="bg-white/90 text-accent text-[8px] font-black uppercase h-4 backdrop-blur-sm">
                          <MapPin className="h-2 w-2 mr-1" />
                          {area.name}
                      </Badge>
                  )}
              </div>
              <p className="text-[10px] text-white font-medium truncate drop-shadow-sm">
                  {photoRecord.description || 'No description provided'}
              </p>
          </div>
        </div>
        
        <CardContent className="p-2 flex items-center justify-between bg-muted/5 mt-auto">
          <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              <Clock className="h-2.5 w-2.5" />
              {format(parseISO(photoRecord.createdAt), 'HH:mm')}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground truncate max-w-[100px]">
              <User className="h-2.5 w-2.5" />
              <span className="truncate">{photoRecord.createdByEmail.split('@')[0]}</span>
          </div>
        </CardContent>
      </Card>

      {photoCount > 1 && (
          <div className="flex gap-1 mt-1 overflow-x-auto no-scrollbar">
              {photoRecord.photos.slice(1, 5).map((p, idx) => (
                  <div key={idx} className="relative w-10 h-8 rounded border overflow-hidden cursor-pointer shrink-0" onClick={() => setViewingPhoto(p)}>
                      <Image src={p.url} alt="site" fill className="object-cover" />
                  </div>
              ))}
              {photoCount > 5 && (
                  <div className="w-10 h-8 rounded bg-muted border flex items-center justify-center text-[8px] font-bold text-muted-foreground">+{photoCount - 5}</div>
              )}
          </div>
      )}

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
