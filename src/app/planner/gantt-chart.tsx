
'use client';

import { useMemo, useState } from 'react';
import type { PlannerTask, Trade, Photo } from '@/lib/types';
import { 
    format, 
    addDays, 
    startOfDay, 
    isSameDay, 
    differenceInDays, 
    eachDayOfInterval, 
    startOfWeek, 
    endOfWeek,
    isWeekend
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';

const DAY_WIDTH = 40; // px per day
const TIMELINE_WEEKS = 4;

export function GanttChart({ tasks, trades }: { tasks: PlannerTask[]; trades: Trade[] }) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const startDate = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const endDate = useMemo(() => addDays(startDate, TIMELINE_WEEKS * 7 - 1), [startDate]);
  
  const timelineDays = useMemo(() => 
    eachDayOfInterval({ start: startDate, end: endDate }), 
    [startDate, endDate]
  );

  const chartWidth = timelineDays.length * DAY_WIDTH;

  if (tasks.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
            <p>No tasks scheduled within the planning window.</p>
        </div>
    );
  }

  return (
    <>
        <div className="bg-background border rounded-xl overflow-hidden shadow-sm">
        <div className="flex flex-col min-w-max">
            {/* Header: Dates */}
            <div className="flex border-b bg-muted/30">
            <div className="w-64 border-r p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground shrink-0 flex items-end">
                Activity / Trade
            </div>
            <div className="flex">
                {timelineDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const isSatSun = isWeekend(day);
                
                return (
                    <div 
                    key={i} 
                    className={cn(
                        "flex flex-col items-center justify-center border-r shrink-0 py-2",
                        isToday && "bg-primary/10 text-primary",
                        isSatSun && "bg-muted/50"
                    )}
                    style={{ width: DAY_WIDTH }}
                    >
                    <span className="text-[9px] uppercase font-bold">{format(day, 'EEE')}</span>
                    <span className={cn("text-xs font-bold", isToday ? "text-primary" : "text-foreground")}>
                        {format(day, 'd')}
                    </span>
                    </div>
                );
                })}
            </div>
            </div>

            {/* Rows: Tasks */}
            <ScrollArea className="max-h-[600px]">
                <TooltipProvider>
                    <div className="flex flex-col">
                        {tasks.map((task) => {
                            const trade = trades.find(t => t.id === task.tradeId);
                            const taskStart = startOfDay(new Date(task.startDate));
                            const offsetDays = differenceInDays(taskStart, startDate);
                            const leftOffset = offsetDays * DAY_WIDTH;
                            const barWidth = task.durationDays * DAY_WIDTH;

                            // Check if task is outside our 4-week window
                            const isVisible = taskStart <= endDate && addDays(taskStart, task.durationDays) >= startDate;

                            return (
                                <div key={task.id} className="flex border-b hover:bg-muted/10 transition-colors group">
                                    <div className="w-64 border-r p-3 shrink-0 min-w-0">
                                        <p className={cn("text-sm font-bold truncate", task.status === 'completed' && "text-muted-foreground line-through")}>
                                            {task.title}
                                        </p>
                                        <Badge variant="outline" className="text-[8px] h-4 mt-1 bg-background">
                                            {trade?.name || 'Trade'}
                                        </Badge>
                                    </div>
                                    <div className="relative flex-1 bg-[repeating-linear-gradient(to_right,transparent,transparent_39px,rgba(0,0,0,0.05)_39px,rgba(0,0,0,0.05)_40px)]" style={{ width: chartWidth }}>
                                        {isVisible && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className={cn(
                                                            "absolute h-8 top-2 rounded-md shadow-sm border-2 flex items-center px-2 transition-all group-hover:shadow-md cursor-help",
                                                            task.status === 'completed' ? "bg-green-500 border-green-600 text-white" : 
                                                            task.status === 'in-progress' ? "bg-primary border-primary-foreground/20 text-white animate-pulse" : 
                                                            "bg-primary/20 border-primary/30 text-primary"
                                                        )}
                                                        style={{ 
                                                            left: leftOffset, 
                                                            width: barWidth,
                                                            zIndex: 10
                                                        }}
                                                    >
                                                        {barWidth > 60 && <span className="text-[10px] font-black truncate">{task.durationDays}d</span>}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-3 w-64">
                                                    <div className="space-y-2">
                                                        <div>
                                                            <p className="font-bold text-sm">{task.title}</p>
                                                            <p className="text-xs text-muted-foreground">{trade?.name}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                            <span>{format(taskStart, 'PP')} &rsaquo; {task.durationDays} Days</span>
                                                        </div>
                                                        <Separator />
                                                        
                                                        {task.photos && task.photos.length > 0 && (
                                                            <div className="grid grid-cols-3 gap-1 pt-1">
                                                                {task.photos.map((p, idx) => (
                                                                    <div key={idx} className="relative aspect-square rounded border overflow-hidden cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                                                        <Image src={p.url} alt="Site Context" fill className="object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <p className="text-[10px] font-black uppercase text-primary">Status: {task.status}</p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </TooltipProvider>
            </ScrollArea>
        </div>
        </div>
        <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}

function ScrollArea({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("overflow-auto", className)}>{children}</div>;
}
