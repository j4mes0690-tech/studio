
'use client';

import { useMemo, useState } from 'react';
import type { SiteDiaryEntry, Project, Photo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Thermometer, 
  Users, 
  MapPin, 
  Trash2, 
  Maximize2,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useTransition } from 'react';
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
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const WEATHER_ICONS: Record<string, any> = {
  'Sunny': Sun,
  'Cloudy': Cloud,
  'Rain': CloudRain,
  'Windy': Wind,
  'Mixed': CloudRain,
};

export function DiaryCard({ 
  entry, 
  project 
}: { 
  entry: SiteDiaryEntry; 
  project?: Project;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const WeatherIcon = WEATHER_ICONS[entry.weather.condition] || Cloud;

  const totalPersonnel = useMemo(() => {
    return entry.subcontractorLogs.reduce((sum, log) => sum + log.employeeCount, 0);
  }, [entry.subcontractorLogs]);

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'site-diary', entry.id);
      await deleteDoc(docRef);
      toast({ title: 'Deleted', description: 'Diary entry removed.' });
    });
  };

  return (
    <>
      <Card className="hover:border-primary transition-all shadow-sm overflow-hidden group">
        <CardHeader className="bg-muted/10 pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-black">
                  <ClientDate date={entry.date} format="date" />
                </CardTitle>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-background border rounded-full text-primary font-bold text-[10px] uppercase">
                    <WeatherIcon className="h-3 w-3" />
                    {entry.weather.condition}
                    {entry.weather.temp && <span>• {entry.weather.temp}°C</span>}
                </div>
              </div>
              <CardDescription className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-tight">
                <Building2 className="h-3 w-3 text-muted-foreground" /> {project?.name || 'Unknown Project'}
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
                        <AlertDialogTitle>Delete Diary Entry?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove the log for this date. Action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border-2 border-primary/10">
              <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                      <Users className="h-5 w-5" />
                  </div>
                  <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">On-Site Workforce</p>
                      <p className="text-lg font-black text-primary leading-none">{totalPersonnel} Operatives</p>
                  </div>
              </div>
              <Badge variant="outline" className="h-6 font-bold bg-background">{entry.subcontractorLogs.length} Trades</Badge>
          </div>

          <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">Resource Breakdown</p>
              <div className="space-y-1">
                  {entry.subcontractorLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-transparent hover:border-border transition-colors">
                          <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">{log.subcontractorName}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-2 w-2" /> {log.areaName || 'Site Wide'}
                              </p>
                          </div>
                          <span className="text-xs font-black text-primary">{log.employeeCount}</span>
                      </div>
                  ))}
              </div>
          </div>

          {entry.generalComments && (
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground tracking-widest px-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>Activity Log</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed bg-muted/10 p-3 rounded border border-dashed italic">
                      "{entry.generalComments}"
                  </p>
              </div>
          )}

          {entry.photos && entry.photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                  {entry.photos.map((p, i) => (
                      <div key={i} className="relative w-12 h-12 rounded-lg border overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => setViewingPhoto(p)}>
                          <Image src={p.url} alt="Diary" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
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

function Building2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}
