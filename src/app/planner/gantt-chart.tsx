'use client';

import { useMemo, useState } from 'react';
import type { PlannerTask, SubContractor, Photo, Project, Planner, PlannerSection } from '@/lib/types';
import { 
    format, 
    addDays, 
    isSameDay, 
    differenceInDays, 
    eachDayOfInterval, 
    startOfWeek, 
    isValid,
    endOfWeek
} from 'date-fns';
import { cn, parseDateString, calculateFinishDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { Layers } from 'lucide-react';

const DAY_WIDTH = 40; // px per day
const ROW_HEIGHT = 48; // Optimized height for side-by-side labels
const SECTION_HEADER_HEIGHT = 32; // px per section header row
const MIN_WEEKS = 12; // Minimum timeline width if no tasks exist

function getTradeColor(id: string, subContractors: SubContractor[]) {
  const sub = subContractors.find(s => s.id === id);
  if (sub?.color) return sub.color;

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

function getTaskSegments(
    startDateStr: string, 
    duration: number, 
    status: string,
    actualFinishStr: string | null | undefined,
    timelineStart: Date,
    planner?: Planner
) {
    const start = parseDateString(startDateStr);
    const sat = !!planner?.includeSaturday;
    const sun = !!planner?.includeSunday;
    
    const finishDateStr = status === 'completed' && actualFinishStr
        ? actualFinishStr 
        : calculateFinishDate(startDateStr, duration, sat, sun);
    
    const end = parseDateString(finishDateStr);
    
    if (!isValid(start) || !isValid(end) || start > end) return [];
    
    const days = eachDayOfInterval({ start, end });
    const segments: { start: Date; days: number }[] = [];
    let currentSegment: { start: Date; days: number } | null = null;
    
    days.forEach(day => {
        const dayOfWeek = day.getDay();
        const isWorking = !((dayOfWeek === 6 && !sat) || (dayOfWeek === 0 && !sun));
        
        if (isWorking) {
            if (!currentSegment) {
                currentSegment = { start: day, days: 1 };
            } else {
                currentSegment.days++;
            }
        } else {
            if (currentSegment) {
                segments.push(currentSegment);
                currentSegment = null;
            }
        }
    });
    
    if (currentSegment) {
        segments.push(currentSegment);
    }
    
    return segments.map(seg => ({
        left: (differenceInDays(seg.start, timelineStart) * DAY_WIDTH),
        width: seg.days * DAY_WIDTH,
        isFirst: isSameDay(seg.start, start),
        isLast: isSameDay(addDays(seg.start, seg.days - 1), end)
    }));
}

export function GanttChart({ 
  tasks, 
  subContractors, 
  projects,
  planner,
  onTaskClick,
  startDateOverride,
  endDateOverride,
  isPrinting = false
}: { 
  tasks: PlannerTask[]; 
  subContractors: SubContractor[]; 
  projects: Project[];
  planner?: Planner;
  onTaskClick: (task: PlannerTask) => void;
  startDateOverride?: Date;
  endDateOverride?: Date;
  isPrinting?: boolean;
}) {
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const groupedData = useMemo(() => {
    const groups: { section: PlannerSection | null, tasks: PlannerTask[] }[] = [];
    const sections = planner?.sections || [];
    
    sections.forEach(s => {
        groups.push({ 
            section: s, 
            tasks: tasks.filter(t => t.sectionId === s.id) 
        });
    });

    const generalTasks = tasks.filter(t => !t.sectionId || !sections.some(s => s.id === t.sectionId));
    if (generalTasks.length > 0) {
        groups.push({ section: null, tasks: generalTasks });
    }

    return groups.filter(g => g.tasks.length > 0);
  }, [tasks, planner]);

  const flattenedTasks = useMemo(() => groupedData.flatMap(g => g.tasks), [groupedData]);

  const startDate = useMemo(() => {
    if (startDateOverride) return startOfWeek(startDateOverride, { weekStartsOn: 1 });
    
    let minDate = new Date();
    if (tasks.length > 0) {
        tasks.forEach(t => {
            const d = parseDateString(t.startDate);
            if (isValid(d) && d < minDate) minDate = d;
        });
    }
    const buffered = addDays(minDate, -7);
    return startOfWeek(buffered, { weekStartsOn: 1 });
  }, [tasks, startDateOverride]);

  const endDate = useMemo(() => {
    if (endDateOverride) return endOfWeek(endDateOverride, { weekStartsOn: 1 });

    let maxDate = addDays(startDate, MIN_WEEKS * 7);
    if (tasks.length > 0) {
        const sat = !!planner?.includeSaturday;
        const sun = !!planner?.includeSunday;
        tasks.forEach(t => {
            const finishStr = t.status === 'completed' && t.actualCompletionDate 
                ? t.actualCompletionDate 
                : calculateFinishDate(t.startDate, t.durationDays, sat, sun);
            const d = parseDateString(finishStr);
            if (isValid(d) && d > maxDate) maxDate = d;
        });
    }
    return endOfWeek(addDays(maxDate, 14), { weekStartsOn: 1 });
  }, [startDate, tasks, planner, endDateOverride]);
  
  const timelineDays = useMemo(() => {
    try {
        return eachDayOfInterval({ start: startDate, end: endDate });
    } catch (e) {
        return [];
    }
  }, [startDate, endDate]);

  const chartWidth = timelineDays.length * DAY_WIDTH;

  const taskMap = useMemo(() => {
    const map = new Map<string, { task: PlannerTask; index: number; yOffset: number }>();
    let currentY = 0;
    
    groupedData.forEach((group) => {
        currentY += SECTION_HEADER_HEIGHT;
        group.tasks.forEach((t) => {
            map.set(t.id, { task: t, index: 0, yOffset: currentY });
            currentY += ROW_HEIGHT;
        });
    });
    return map;
  }, [groupedData]);

  const chartHeight = useMemo(() => {
    let total = 0;
    groupedData.forEach(g => {
        total += SECTION_HEADER_HEIGHT;
        total += g.tasks.length * ROW_HEIGHT;
    });
    return total;
  }, [groupedData]);

  const dependencyArrows = useMemo(() => {
    const arrows: React.ReactNode[] = [];
    const arrowHeadSize = 6;
    
    flattenedTasks.forEach((task) => {
      const taskData = taskMap.get(task.id);
      if (!taskData || !task.predecessorIds) return;

      const taskStart = parseDateString(task.startDate);
      if (!isValid(taskStart)) return;

      const successorX = (differenceInDays(taskStart, startDate) * DAY_WIDTH);
      const successorY = taskData.yOffset + (ROW_HEIGHT / 2);

      task.predecessorIds.forEach(predId => {
        const predData = taskMap.get(predId);
        if (!predData) return;

        const pred = predData.task;
        const predStart = parseDateString(pred.startDate);
        if (!isValid(predStart)) return;
        
        const sat = !!planner?.includeSaturday;
        const sun = !!planner?.includeSunday;
        const finishDateStr = pred.status === 'completed' && pred.actualCompletionDate 
            ? pred.actualCompletionDate 
            : calculateFinishDate(pred.startDate, pred.durationDays, sat, sun);
        
        const predFinish = parseDateString(finishDateStr);
        const predecessorEndX = (differenceInDays(predFinish, startDate) + 1) * DAY_WIDTH;
        const predecessorY = predData.yOffset + (ROW_HEIGHT / 2);

        const midX = predecessorEndX + ((successorX - predecessorEndX) / 2);
        
        arrows.push(
          <g key={`${predId}-${task.id}`} style={{ color: '#f26522' }} opacity={0.4}>
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
  }, [flattenedTasks, startDate, taskMap, planner]);

  if (tasks.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/10 text-muted-foreground">
            <p>No activities scheduled within this planning block.</p>
        </div>
    );
  }

  return (
    <>
        <div 
            id="planner-gantt-container"
            className={cn(
                "bg-background border rounded-xl shadow-sm overflow-x-auto overflow-y-hidden select-none",
                isPrinting && "overflow-visible border-none shadow-none rounded-none"
            )}
        >
            <div id="planner-gantt-capture" className="min-w-max flex flex-col relative" style={{ width: chartWidth + 256 }}>
                <div className={cn("flex border-b bg-muted/30", !isPrinting && "sticky top-0 z-40")}>
                    <div className={cn(
                        "w-64 border-r p-4 font-bold text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 flex items-end bg-muted/30",
                        !isPrinting && "sticky left-0 z-50 backdrop-blur-md"
                    )}>
                        Work Activity
                    </div>
                    <div className="flex" style={{ width: chartWidth }}>
                        {timelineDays.map((day, i) => {
                            const isToday = isSameDay(day, new Date());
                            const dayOfWeek = day.getDay();
                            const isSat = dayOfWeek === 6;
                            const isSun = dayOfWeek === 0;
                            const isNonWorking = (isSat && !planner?.includeSaturday) || (isSun && !planner?.includeSunday);
                            
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "flex flex-col items-center justify-center border-r shrink-0 py-2",
                                        isToday && "bg-primary/10 text-primary font-black",
                                        isNonWorking && "bg-muted/50"
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

                <div className="flex">
                    <div className={cn(
                        "flex flex-col border-r shrink-0 w-64 bg-background",
                        !isPrinting && "sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                    )}>
                        {groupedData.map((group, gIdx) => (
                            <div key={`g-left-${gIdx}`} className="flex flex-col">
                                <div 
                                    className="bg-muted/50 px-4 flex items-center gap-2 border-b"
                                    style={{ height: SECTION_HEADER_HEIGHT }}
                                >
                                    <Layers className="h-3 w-3 text-primary opacity-60" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate">
                                        {group.section?.name || 'General Activities'}
                                    </span>
                                </div>
                                {group.tasks.map(task => {
                                    const sub = subContractors.find(s => s.id === task.subcontractorId);
                                    const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned');
                                    const tradeColor = getTradeColor(task.subcontractorId || '', subContractors);
                                    return (
                                        <div key={task.id} className="border-b px-4 flex flex-row items-center justify-between min-w-0 gap-2" style={{ height: ROW_HEIGHT }}>
                                            <p className={cn("text-[11px] font-bold truncate leading-none m-0 flex-1", task.status === 'completed' && "text-muted-foreground line-through")}>{task.title}</p>
                                            <Badge variant="outline" className="text-[8px] h-4 bg-background truncate px-1.5 shrink-0" style={{ borderColor: `${tradeColor}40`, color: tradeColor }}>
                                                {tradeName}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    <div className="relative flex-1" style={{ width: chartWidth }}>
                        <div className="absolute inset-0 flex z-0 pointer-events-none">
                            {timelineDays.map((day, i) => {
                                const dayOfWeek = day.getDay();
                                const isSat = dayOfWeek === 6;
                                const isSun = dayOfWeek === 0;
                                const isNonWorking = (isSat && !planner?.includeSaturday) || (isSun && !planner?.includeSunday);
                                return (
                                    <div 
                                        key={i} 
                                        className={cn("h-full border-r", isNonWorking && "bg-muted/20")} 
                                        style={{ width: DAY_WIDTH }}
                                    />
                                );
                            })}
                        </div>

                        <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: chartWidth, height: chartHeight }}>
                            {dependencyArrows}
                        </svg>

                        <div className="relative z-20 flex flex-col">
                            {groupedData.map((group, gIdx) => (
                                <div key={`g-right-${gIdx}`} className="flex flex-col">
                                    <div className="bg-muted/30 border-b w-full" style={{ height: SECTION_HEADER_HEIGHT }} />
                                    {group.tasks.map((task) => {
                                        const tradeColor = getTradeColor(task.subcontractorId || '', subContractors);
                                        const sub = subContractors.find(s => s.id === task.subcontractorId);
                                        const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned');

                                        const segments = getTaskSegments(
                                            task.startDate, 
                                            task.durationDays, 
                                            task.status, 
                                            task.actualCompletionDate, 
                                            startDate, 
                                            planner
                                        );

                                        const baselineSegments = task.originalStartDate && task.originalDurationDays ? getTaskSegments(
                                            task.originalStartDate,
                                            task.originalDurationDays,
                                            'pending',
                                            null,
                                            startDate,
                                            planner
                                        ) : [];

                                        return (
                                            <div key={task.id} className="border-b relative" style={{ height: ROW_HEIGHT, width: chartWidth }}>
                                                {baselineSegments.map((seg, sIdx) => (
                                                    <div 
                                                        key={`baseline-${sIdx}`}
                                                        className="absolute h-1.5 top-2 opacity-20 bg-slate-400 border border-slate-500 z-0"
                                                        style={{ 
                                                            left: seg.left, 
                                                            width: seg.width,
                                                            borderTopLeftRadius: seg.isFirst ? '2px' : '0',
                                                            borderBottomLeftRadius: seg.isFirst ? '2px' : '0',
                                                            borderTopRightRadius: seg.isLast ? '2px' : '0',
                                                            borderBottomRightRadius: seg.isLast ? '2px' : '0',
                                                            borderLeft: seg.isFirst ? '' : 'none',
                                                            borderRight: seg.isLast ? '' : 'none'
                                                        }}
                                                    />
                                                ))}

                                                {segments.map((seg, sIdx) => (
                                                    <TooltipProvider key={`task-${sIdx}`}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div 
                                                                    className={cn(
                                                                        "absolute h-6 top-5 shadow-sm border-2 flex items-center px-2 transition-all hover:scale-[1.02] cursor-pointer z-10 pointer-events-auto",
                                                                        task.status === 'completed' ? "text-white opacity-80" : 
                                                                        task.status === 'in-progress' ? "text-white animate-pulse" : 
                                                                        "text-white",
                                                                        seg.isFirst && "rounded-l-md",
                                                                        seg.isLast && "rounded-r-md"
                                                                    )}
                                                                    style={{ 
                                                                        left: seg.left, 
                                                                        width: seg.width,
                                                                        backgroundColor: tradeColor,
                                                                        borderColor: `${tradeColor}cc`,
                                                                        borderLeft: seg.isFirst ? '' : 'none',
                                                                        borderRight: seg.isLast ? '' : 'none'
                                                                    }}
                                                                    onClick={() => onTaskClick(task)}
                                                                >
                                                                    {seg.isFirst && seg.width > 40 && <span className="text-[9px] font-black truncate">{task.durationDays}d</span>}
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
                                                                        <span className='flex justify-between'>Forecast: <strong>{format(parseDateString(task.startDate), 'PP')} ({task.durationDays}d)</strong></span>
                                                                        {task.status === 'completed' && task.actualCompletionDate && (
                                                                            <span className='flex justify-between text-green-600 font-bold'>Actual Finish: <strong>{format(parseDateString(task.actualCompletionDate), 'PP')}</strong></span>
                                                                        )}
                                                                        {task.originalStartDate && (
                                                                            <span className='flex justify-between opacity-60'>Baseline: <strong>{format(parseDateString(task.originalStartDate), 'PP')}</strong></span>
                                                                        )}
                                                                    </div>
                                                                    <Separator className="my-1" />
                                                                    <p className="text-[9px] text-center font-bold text-primary italic">Click to edit reforecast</p>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
