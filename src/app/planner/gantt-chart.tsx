'use client';

import { useMemo, useState } from 'react';
import type { PlannerTask, SubContractor, Photo, Project } from '@/lib/types';
import { 
    format, 
    addDays, 
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

const DAY_WIDTH = 40; // px per day
const TIMELINE_WEEKS = 4;
const ROW_HEIGHT = 52; // px per task row

// Timezone-safe date parser for construction dates (YYYY-MM-DD)
function parseDateString(dateStr: string | null | undefined) {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getTradeColor(id: string) {
  const colors = [
    '#2563eb', '#ea580c', '#16a34a', '#7c3aed', '#db2777', 
    '#0891b2', '#4f46e5', '#059669', '#d97706', '#dc2626', 
    '#9333ea', '#0284c7', '#4d7c0f', '#be185d', '#1d4ed8', 
    '#c2410c', '#15803d', '#6d28d9', '#0e7490', '#4338ca',
  ];
  
  if (!id || id === 'other') return '#64748b';
  
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function GanttChart({ 
  tasks, 
  subContractors, 
  projects,
  onTaskClick 
}: { 
  tasks: PlannerTask[]; 
  subContractors: SubContractor[]; 
  projects: Project[];
  onTaskClick: (task: PlannerTask) => void;
}) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

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
    const arrowHeadSize = 6;
    
    tasks.forEach((task, taskIdx) => {
      if (!task.predecessorIds) return;

      const taskStart = parseDateString(task.startDate);
      if (!isValid(taskStart)) return;

      const successorX = differenceInDays(taskStart, startDate) * DAY_WIDTH;
      const successorY = (taskIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

      task.predecessorIds.forEach(predId => {
        const predData = taskMap.get(predId);
        if (!predData) return;

        const pred = predData.task;
        const predIdx = predData.index;
        const predStart = parseDateString(pred.startDate);
        if (!isValid(predStart)) return;
        
        const effectiveDuration = pred.status === 'completed' && pred.actualCompletionDate 
            ? Math.max(1, differenceInDays(parseDateString(pred.actualCompletionDate), predStart) + 1)
            : pred.durationDays;

        const predecessorEndX = (differenceInDays(predStart, startDate) + effectiveDuration) * DAY_WIDTH;
        const predecessorY = (predIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

        const midX = predecessorEndX + ((successorX - predecessorEndX) / 2);
        
        arrows.push(
          <g key={`${predId}-${task.id}`} className="text-primary/40">
            <path
              d={`M ${predecessorEndX} ${predecessorY} L ${midX} ${predecessorY} L ${midX} ${successorY} L ${successorX} ${successorY}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <polygon 
              points={`${successorX},${successorY} ${successorX-arrowHeadSize},${successorY-(arrowHeadSize/1.5)} ${successorX-arrowHeadSize},${successorY+(arrowHeadSize/1.5)}`}
              fill="currentColor"
            />
          </g>
        );
      });
    });

    return arrows;
  }, [tasks, startDate, taskMap]);

  if (tasks.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
            <p>No activities scheduled within this planning block.</p>
        </div>
    );
  }

  return (
    <>
        <div id="planner-gantt-capture" className="bg-background border rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-col min-w-max">
                {/* Timeline Header */}
                <div className="flex border-b bg-muted/30">
                    <div className="w-64 border-r p-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 flex items-end sticky left-0 z-30 bg-muted/30 backdrop-blur-sm">
                        Work Activity
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
                                    <span className={cn("text-xs font-bold", isToday ? "text-primary" : "text-foreground")}>{format(day, 'd')}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Gantt Body */}
                <div className="flex">
                    {/* Left Column: Task Labels (Sticky) */}
                    <div className="flex flex-col border-r shrink-0 w-64 bg-background sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        {tasks.map(task => {
                            const sub = subContractors.find(s => s.id === task.subcontractorId);
                            const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned');
                            const tradeColor = getTradeColor(task.subcontractorId || '');
                            return (
                                <div key={task.id} className="border-b px-4 py-2 flex flex-col justify-center min-w-0" style={{ height: ROW_HEIGHT }}>
                                    <p className={cn("text-[11px] font-bold truncate", task.status === 'completed' && "text-muted-foreground line-through")}>{task.title}</p>
                                    <Badge variant="outline" className="text-[8px] h-3.5 mt-0.5 bg-background truncate w-fit max-w-full" style={{ borderColor: `${tradeColor}40`, color: tradeColor }}>
                                        {tradeName}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>

                    {/* Right Column: Bars & SVG Overlay */}
                    <div className="relative flex-1 bg-[repeating-linear-gradient(to_right,transparent,transparent_39px,rgba(0,0,0,0.05)_39px,rgba(0,0,0,0.05)_40px)]" style={{ width: chartWidth }}>
                        <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: chartWidth, height: chartHeight }}>
                            {dependencyArrows}
                        </svg>

                        <TooltipProvider>
                            {tasks.map((task, taskIdx) => {
                                const taskStart = parseDateString(task.startDate);
                                if (!isValid(taskStart)) return null;

                                const offsetDays = differenceInDays(taskStart, startDate);
                                const leftOffset = offsetDays * DAY_WIDTH;
                                const barWidth = task.durationDays * DAY_WIDTH;

                                let actualBarWidth = barWidth;
                                if (task.status === 'completed' && task.actualCompletionDate) {
                                    const actualEnd = parseDateString(task.actualCompletionDate);
                                    if (isValid(actualEnd)) {
                                        actualBarWidth = (differenceInDays(actualEnd, taskStart) + 1) * DAY_WIDTH;
                                    }
                                }

                                const tradeColor = getTradeColor(task.subcontractorId || '');
                                const isVisible = (taskStart <= endDate && addDays(taskStart, task.durationDays) >= startDate);

                                const hasBaseline = !!task.originalStartDate && !!task.originalDurationDays;
                                const origStart = hasBaseline ? parseDateString(task.originalStartDate) : null;
                                const isValidBaseline = origStart && isValid(origStart);
                                const origOffset = isValidBaseline ? differenceInDays(origStart!, startDate) * DAY_WIDTH : 0;
                                const origWidth = hasBaseline ? task.originalDurationDays * DAY_WIDTH : 0;
                                const isBaselineVisible = isValidBaseline && (origStart! <= endDate && addDays(origStart!, task.originalDurationDays) >= startDate);

                                const sub = subContractors.find(s => s.id === task.subcontractorId);
                                const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned');

                                return (
                                    <div key={task.id} className="border-b relative" style={{ height: ROW_HEIGHT, width: chartWidth }}>
                                        {isBaselineVisible && (
                                            <div 
                                                className="absolute h-4 top-1.5 opacity-20 bg-slate-400 rounded-sm border border-slate-500 z-0"
                                                style={{ left: origOffset, width: origWidth }}
                                                title="Original Planned Period"
                                            />
                                        )}

                                        {isVisible && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className={cn(
                                                            "absolute h-7 top-4 rounded-md shadow-sm border-2 flex items-center px-2 transition-all hover:scale-[1.02] cursor-pointer z-10 pointer-events-auto",
                                                            task.status === 'completed' ? "text-white opacity-80" : 
                                                            task.status === 'in-progress' ? "text-white animate-pulse" : 
                                                            "text-white"
                                                        )}
                                                        style={{ 
                                                            left: leftOffset, 
                                                            width: actualBarWidth,
                                                            backgroundColor: tradeColor,
                                                            borderColor: `${tradeColor}cc`
                                                        }}
                                                        onClick={() => onTaskClick(task)}
                                                    >
                                                        {actualBarWidth > 40 && <span className="text-[9px] font-black truncate">{Math.round(actualBarWidth / DAY_WIDTH)}d</span>}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="p-3 w-64 z-[100]">
                                                    <div className="space-y-2">
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <p className="font-bold text-sm">{task.title}</p>
                                                                <p className="text-xs font-semibold" style={{ color: tradeColor }}>{tradeName}</p>
                                                            </div>
                                                            <Badge variant="outline" className="text-[8px] uppercase font-black">{task.status}</Badge>
                                                        </div>
                                                        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                                                            <span className='flex justify-between'>Forecast: <strong>{format(taskStart, 'PP')} ({task.durationDays}d)</strong></span>
                                                            {task.status === 'completed' && task.actualCompletionDate && (
                                                                <span className='flex justify-between text-green-600 font-bold'>Actual Finish: <strong>{format(parseDateString(task.actualCompletionDate), 'PP')}</strong></span>
                                                            )}
                                                            {task.originalStartDate && (
                                                                <span className='flex justify-between opacity-60'>Baseline: <strong>{format(parseDateString(task.originalStartDate), 'PP')}</strong></span>
                                                            )}
                                                        </div>
                                                        {task.photos && task.photos.length > 0 && (
                                                            <div className="grid grid-cols-3 gap-1 pt-1">
                                                                {task.photos.map((p, idx) => (
                                                                    <div key={idx} className="relative aspect-square rounded border overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}>
                                                                        <Image src={p.url} alt="Context" fill className="object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <Separator className="my-1" />
                                                        <p className="text-[9px] text-center font-bold text-primary italic">Click to edit reforecast</p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                );
                            })}
                        </TooltipProvider>
                    </div>
                </div>
            </div>
        </div>

        <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
