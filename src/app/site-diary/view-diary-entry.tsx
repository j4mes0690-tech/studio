'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Users, 
  MapPin, 
  MessageSquare,
  Building2,
  Maximize2,
  Calendar
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import type { SiteDiaryEntry, Project, Photo } from '@/lib/types';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { ImageLightbox } from '@/components/image-lightbox';
import { cn } from '@/lib/utils';

const WEATHER_ICONS: Record<string, any> = {
  'Sunny': Sun,
  'Cloudy': Cloud,
  'Rain': CloudRain,
  'Windy': Wind,
  'Mixed': CloudRain,
};

export function ViewDiaryEntry({ 
  entry, 
  project,
  open,
  onOpenChange
}: { 
  entry: SiteDiaryEntry; 
  project?: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const WeatherIcon = WEATHER_ICONS[entry.weather.condition] || Cloud;

  const totalPersonnel = useMemo(() => {
    return entry.subcontractorLogs.reduce((sum, log) => sum + (log.operativeCount || (log as any).employeeCount || 0), 0);
  }, [entry.subcontractorLogs]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black">
                    <ClientDate date={entry.date} format="date" />
                  </DialogTitle>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted border rounded-full text-primary font-bold text-[10px] uppercase">
                      <WeatherIcon className="h-3 w-3" />
                      {entry.weather.condition}
                      {entry.weather.temp && <span>• {entry.weather.temp}°C</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 font-bold text-muted-foreground text-xs uppercase tracking-tight">
                  <Building2 className="h-3 w-3" /> {project?.name || 'Unknown Project'}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-8 py-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border-2 border-primary/10 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg text-primary">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1.5">Total Workforce</p>
                        <p className="text-2xl font-black text-primary leading-none">{totalPersonnel} Operatives</p>
                    </div>
                </div>
                <Badge variant="outline" className="h-7 px-3 font-bold bg-background">{entry.subcontractorLogs.length} Trade Groups</Badge>
            </div>

            <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Resource Allocation</p>
                <div className="grid gap-2">
                    {entry.subcontractorLogs.map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-muted/5">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-foreground truncate">{log.subcontractorName}</p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" /> {log.areaName || 'Site Wide'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {log.notes && (
                                    <span className="text-[10px] text-muted-foreground italic max-w-[150px] truncate hidden sm:inline">
                                        "{log.notes}"
                                    </span>
                                )}
                                <Badge className="font-black text-xs px-2.5">
                                    {log.operativeCount || (log as any).employeeCount || 0}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {entry.generalComments && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>Daily Narrative</span>
                    </div>
                    <div className="text-sm text-foreground leading-relaxed bg-muted/10 p-4 rounded-xl border border-dashed whitespace-pre-wrap font-medium">
                        {entry.generalComments}
                    </div>
                </div>
            )}

            {entry.photos && entry.photos.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Visual Documentation</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {entry.photos.map((p, i) => (
                            <div 
                                key={i} 
                                className="relative aspect-video rounded-xl border-2 border-muted overflow-hidden cursor-pointer group shadow-sm bg-muted" 
                                onClick={() => setViewingPhoto(p)}
                            >
                                <Image src={p.url} alt="Site documentation" fill className="object-cover transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="h-5 w-5 text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-4">
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Logged on <ClientDate date={entry.createdAt} /></span>
                <span>By: {entry.createdByEmail}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
