
'use client';

import { useMemo } from 'react';
import type { SiteDiaryEntry, SubContractor } from '@/lib/types';
import { 
    format, 
    eachDayOfInterval, 
    parseISO, 
    isSameDay, 
    isWeekend,
    isValid
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Sun, Cloud, CloudRain, Wind, Thermometer } from 'lucide-react';

const DAY_WIDTH = 48; // Increased slightly for clarity with numbers

const WEATHER_ICONS: Record<string, any> = {
  'Sunny': Sun,
  'Cloudy': Cloud,
  'Rain': CloudRain,
  'Windy': Wind,
  'Mixed': CloudRain,
};

export function AttendanceGantt({ 
  entries, 
  startDate, 
  endDate,
  subContractors 
}: { 
  entries: SiteDiaryEntry[]; 
  startDate: string; 
  endDate: string;
  subContractors: SubContractor[];
}) {
  const timelineDays = useMemo(() => {
    try {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        if (!isValid(start) || !isValid(end)) return [];
        return eachDayOfInterval({ start, end });
    } catch (e) {
        return [];
    }
  }, [startDate, endDate]);

  const activeSubIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach(entry => {
      entry.subcontractorLogs.forEach(log => ids.add(log.subcontractorId));
    });
    return Array.from(ids);
  }, [entries]);

  if (timelineDays.length === 0) return null;

  return (
    <div className="bg-background border rounded-xl overflow-x-auto shadow-sm">
      <div className="flex flex-col min-w-max">
        {/* Header: Days + Weather */}
        <div className="flex border-b bg-muted/30">
          <div className="w-48 border-r p-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 flex items-end">
            Sub-contractor
          </div>
          <div className="flex">
            {timelineDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isSatSun = isWeekend(day);
              const dayEntry = entries.find(e => isSameDay(parseISO(e.date), day));
              const WeatherIcon = dayEntry ? (WEATHER_ICONS[dayEntry.weather.condition] || Cloud) : null;

              return (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col items-center justify-between border-r shrink-0 py-2 min-h-[70px]",
                    isToday && "bg-primary/10 text-primary",
                    isSatSun && "bg-muted/50"
                  )}
                  style={{ width: DAY_WIDTH }}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] uppercase font-black opacity-60">{format(day, 'EEE')}</span>
                    <span className={cn("text-sm font-black leading-none", isToday ? "text-primary" : "text-foreground")}>{format(day, 'd')}</span>
                  </div>
                  
                  {dayEntry && (
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                        {WeatherIcon && <WeatherIcon className="h-3 w-3 text-muted-foreground" />}
                        {dayEntry.weather.temp !== undefined && (
                            <span className="text-[8px] font-bold text-muted-foreground leading-none">{dayEntry.weather.temp}°</span>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rows: Subs */}
        <div className="flex flex-col">
          {activeSubIds.map(subId => {
            const sub = subContractors.find(s => s.id === subId);
            return (
              <div key={subId} className="flex border-b group hover:bg-muted/5 transition-colors">
                <div className="w-48 border-r px-4 py-3 flex items-center min-w-0 bg-background sticky left-0 z-10">
                  <span className="text-xs font-bold truncate">{sub?.name || 'Unknown'}</span>
                </div>
                <div className="flex">
                  {timelineDays.map((day, i) => {
                    const entry = entries.find(e => isSameDay(parseISO(e.date), day));
                    const log = entry?.subcontractorLogs.find(l => l.subcontractorId === subId);
                    
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "border-r shrink-0 flex items-center justify-center h-14 relative transition-colors",
                          isWeekend(day) && "bg-muted/20"
                        )}
                        style={{ width: DAY_WIDTH }}
                      >
                        {log ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="absolute inset-1 rounded bg-primary shadow-sm flex items-center justify-center text-[11px] font-black text-white cursor-help hover:scale-110 transition-transform">
                                  {log.operativeCount}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="p-3 w-48">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center border-b pb-1">
                                    <span className="font-bold text-xs">{sub?.name}</span>
                                    <Badge variant="outline" className="text-[9px]">{format(day, 'PP')}</Badge>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <User className="h-3 w-3 text-primary" />
                                      <span><strong>{log.operativeCount}</strong> Operatives</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <MapPin className="h-3 w-3 text-primary" />
                                      <span>{log.areaName || 'Site Wide'}</span>
                                    </div>
                                    {log.notes && (
                                      <div className="text-[9px] text-muted-foreground italic border-t pt-1 mt-1">
                                        "{log.notes}"
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
