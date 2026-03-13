'use client';

import { useMemo, useState } from 'react';
import type { PlannerTask, Trade, Photo, Project } from '@/lib/types';
import { 
    format, 
    addDays, 
    startOfDay, 
    isSameDay, 
    differenceInDays, 
    eachDayOfInterval, 
    startOfWeek, 
    isWeekend,
    isValid
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { EditTaskDialog } from './edit-task';

const DAY_WIDTH = 40; // px per day
const TIMELINE_WEEKS = 4;
const ROW_HEIGHT = 52; // px per task row

export function GanttChart({ tasks, trades, projects }: { tasks: PlannerTask[]; trades: Trade[]; projects: Project[] }) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);

  const startDate = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const endDate = useMemo(() => addDays(startDate, TIMELINE_WEEKS * 7 - 1), [startDate]);
  
  const timelineDays = useMemo(() => 
    eachDayOfInterval({ start: startDate, end: endDate }), 
    [startDate, endDate]
  );

  const chartWidth = timelineDays.length * DAY_WIDTH;
  const chartHeight = tasks.length * ROW_HEIGHT;

  const taskMap = useMemo(() => {
    const map = new Map<string, { task: PlannerTask; index: number }>();
    tasks.forEach((t, i) => map.set(t.id, { task: t, index: i }));
    return map;
  }, [tasks]);

  const dependencyArrows = useMemo(() => {
    const arrows: React.ReactNode[] = [];
    
    tasks.forEach((task, taskIdx) => {
      if (!task.predecessorIds) return;

      const taskStart = startOfDay(parseISO(task.startDate));
      if (!isValid(taskStart)) return;

      const successorX = differenceInDays(taskStart, startDate) * DAY_WIDTH;
      const successorY = (taskIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

      task.predecessorIds.forEach(predId => {
        const predData = taskMap.get(predId);
        if (!predData) return;

        const pred = predData.task;
        const predIdx = predData.index;
        const predStart = startOfDay(parseISO(pred.startDate));
        if (!isValid(predStart)) return;
        
        // Effective completion X
        const effectiveDuration = pred.status === 'completed' && pred.actualCompletionDate 
            ? Math.max(1, differenceInDays(parseISO(pred.actualCompletionDate), predStart) + 1)
            : pred.durationDays;

        const predecessorEndX = (differenceInDays(predStart, startDate) + effectiveDuration) * DAY_WIDTH;
        const predecessorY = (predIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

        const midX = predecessorEndX + ((successorX - predecessorEndX) / 2);
        
        arrows.push(
          <path
            key={`${predId}-${task.id}`}
            d={`M ${predecessorEndX} ${predecessorY} L ${midX} ${predecessorY} L ${midX} ${successorY} L ${successorX} ${successorY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-primary/40"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });

    return arrows;
  }, [tasks, startDate, taskMap]);

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
            <div className="relative overflow-auto" style={{ maxHeight: '600px' }}>
                <TooltipProvider>
                    <div className="flex flex-col relative">
                        {/* SVG Dependency Layer */}
                        <svg 
                            className="absolute top-0 left-[256px] pointer-events-none z-0" 
                            style={{ width: chartWidth, height: chartHeight }}
                        >
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary/40" /></marker>
                            </defs>
                            {dependencyArrows}
                        </svg>

                        {tasks.map((task, taskIdx) => {
                            const trade = trades.find(t => t.id === task.tradeId);
                            const taskStart = startOfDay(parseISO(task.startDate));
                            
                            if (!isValid(taskStart)) return null;

                            const offsetDays = differenceInDays(taskStart, startDate);
                            const leftOffset = offsetDays * DAY_WIDTH;
                            
                            // Forecasted bar width
                            const barWidth = task.durationDays * DAY_WIDTH;

                            // Actual bar width (if completed)
                            let actualBarWidth = barWidth;
                            if (task.status === 'completed' && task.actualCompletionDate) {
                                const actualEnd = parseISO(task.actualCompletionDate);
                                if (isValid(actualEnd)) {
                                    actualBarWidth = (differenceInDays(actualEnd, taskStart) + 1) * DAY_WIDTH;
                                }
                            }

                            // Original Baseline bar calculation with validation
                            const hasBaseline = !!task.originalStartDate && !!task.originalDurationDays;
                            const origStart = hasBaseline ? startOfDay(parseISO(task.originalStartDate)) : null;
                            const isValidBaseline = origStart && isValid(origStart);
                            
                            const origOffset = isValidBaseline ? differenceInDays(origStart!, startDate) * DAY_WIDTH : 0;
                            const origWidth = hasBaseline ? task.originalDurationDays * DAY_WIDTH : 0;

                            const isVisible = (taskStart <= endDate && addDays(taskStart, task.durationDays) >= startDate);
                            const isBaselineVisible = isValidBaseline && (origStart! <= endDate && addDays(origStart!, task.originalDurationDays) >= startDate);

                            return (
                                <div 
                                    key={task.id} 
                                    className="flex border-b hover:bg-muted/10 transition-colors group relative"
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    <div className="w-64 border-r p-2 shrink-0 min-w-0 bg-background z-10">
                                        <p className={cn("text-xs font-bold truncate", task.status === 'completed' && "text-muted-foreground line-through")}>{task.title}</p>
                                        <Badge variant="outline" className="text-[8px] h-3.5 mt-0.5 bg-background">{trade?.name || 'Trade'}</Badge>
                                    </div>
                                    <div className="relative flex-1 bg-[repeating-linear-gradient(to_right,transparent,transparent_39px,rgba(0,0,0,0.05)_39px,rgba(0,0,0,0.05)_40px)]" style={{ width: chartWidth }}>
                                        {/* Original Planned Shadow Bar */}
                                        {isBaselineVisible && (
                                            <div 
                                                className="absolute h-4 top-1.5 opacity-20 bg-slate-400 rounded-sm border border-slate-500 z-0"
                                                style={{ left: origOffset, width: origWidth }}
                                                title="Original Planned Period"
                                            />
                                        )}

                                        {/* Current Forecast / Actual Bar */}
                                        {isVisible && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className={cn(
                                                            "absolute h-7 top-4 rounded-md shadow-sm border-2 flex items-center px-2 transition-all hover:scale-[1.02] cursor-pointer z-10",
                                                            task.status === 'completed' ? "bg-green-500 border-green-600 text-white" : 
                                                            task.status === 'in-progress' ? "bg-primary border-primary-foreground/20 text-white animate-pulse" : 
                                                            "bg-primary/20 border-primary/30 text-primary"
                                                        )}
                                                        style={{ 
                                                            left: leftOffset, 
                                                            width: actualBarWidth,
                                                        }}
                                                        onClick={() => setEditingTask(task)}
                                                    >
                                                        {actualBarWidth > 40 && <span className="text-[9px] font-black truncate">{Math.round(actualBarWidth / DAY_WIDTH)}d</span>}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-3 w-64 z-[100]">
                                                    <div className="space-y-2">
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <p className="font-bold text-sm">{task.title}</p>
                                                                <p className="text-xs text-muted-foreground">{trade?.name}</p>
                                                            </div>
                                                            <Badge variant="outline" className="text-[8px]">{task.status}</Badge>
                                                        </div>
                                                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                                                            <span className='flex justify-between'>Forecast: <strong>{format(taskStart, 'PP')} ({task.durationDays}d)</strong></span>
                                                            {task.status === 'completed' && task.actualCompletionDate && (
                                                                <span className='flex justify-between text-green-600 font-bold'>Completed: <strong>{format(parseISO(task.actualCompletionDate), 'PP')}</strong></span>
                                                            )}
                                                            {task.originalStartDate && (
                                                                <span className='flex justify-between opacity-60'>Planned: <strong>{format(parseISO(task.originalStartDate), 'PP')}</strong></span>
                                                            )}
                                                        </div>
                                                        
                                                        {task.photos && task.photos.length > 0 && (
                                                            <div className="grid grid-cols-3 gap-1 pt-1">
                                                                {task.photos.map((p, idx) => (
                                                                    <div key={idx} className="relative aspect-square rounded border overflow-hidden cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                                                        <Image src={p.url} alt="Context" fill className="object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <Separator className="my-1" />
                                                        <p className="text-[9px] text-center font-bold text-primary italic">Click bar to edit or reforecast</p>
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
            </div>
        </div>
        </div>

        {editingTask && (
            <EditTaskDialog 
                task={editingTask} 
                projects={projects} 
                trades={trades} 
                allTasks={tasks} 
                open={!!editingTask} 
                onOpenChange={(open) => !open && setEditingTask(null)} 
            />
        )}

        <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}

function parseISO(dateStr: string | null | undefined) {
    if (!dateStr) return new Date(NaN);
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}
