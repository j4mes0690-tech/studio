
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Users, CheckCircle2, AlertTriangle, Calendar, ArrowRight } from 'lucide-react';
import type { PlannerTask, Project, SubContractor, Planner } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { sendPlannerEmailAction } from './actions';
import { generatePlannerPDF } from '@/lib/pdf-utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { cn, calculateFinishDate, parseDateString } from '@/lib/utils';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export function DistributePlannerButton({
  tasks,
  project,
  planner,
  subContractors,
}: {
  tasks: PlannerTask[];
  project?: Project;
  planner?: Planner;
  subContractors: SubContractor[];
}) {
  const [open, setOpen] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();

  // Range Settings
  const [scope, setScope] = useState<'full' | 'range'>('full');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Find unique subcontractors involved in this specific planner
  const subsInPlanner = useMemo(() => {
    const ids = Array.from(new Set(tasks.map(t => t.subcontractorId).filter(id => !!id))) as string[];
    return subContractors.filter(s => ids.includes(s.id));
  }, [tasks, subContractors]);

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedSubIds(subsInPlanner.map(s => s.id));
      setScope('full');
    }
  };

  const handleDistribute = async () => {
    if (selectedSubIds.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one trade partner to receive the schedule.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      // 1. Filter tasks for PDF
      let finalTasks = [...tasks];
      const range = scope === 'range' ? { from: dateStart, to: dateEnd } : undefined;
      
      if (range && dateStart && dateEnd) {
          const start = startOfDay(parseISO(dateStart));
          const end = endOfDay(parseISO(dateEnd));
          const sat = !!planner?.includeSaturday;
          const sun = !!planner?.includeSunday;

          finalTasks = tasks.filter(t => {
              const tStart = parseDateString(t.startDate);
              const tFinishStr = t.status === 'completed' && t.actualCompletionDate 
                  ? t.actualCompletionDate 
                  : calculateFinishDate(t.startDate, t.durationDays, sat, sun);
              const tEnd = parseDateString(tFinishStr);
              return (tStart <= end && tEnd >= start);
          });
      }

      if (finalTasks.length === 0) {
          toast({ title: "Distribution Empty", description: "No activities overlap with your selected range.", variant: "destructive" });
          setIsDistributing(false);
          return;
      }

      // 2. Generate the PDF
      const pdf = await generatePlannerPDF(finalTasks, project, planner, subContractors, range);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const fileName = `Schedule-${project?.name.replace(/\s+/g, '-')}-${planner?.name.replace(/\s+/g, '-')}.pdf`;

      // 3. Get recipient emails
      const recipientEmails = subContractors
        .filter(s => selectedSubIds.includes(s.id))
        .map(s => s.email);

      // 4. Send via Resend
      const result = await sendPlannerEmailAction({
        emails: recipientEmails,
        projectName: project?.name || 'Project',
        plannerName: planner?.name || 'Schedule',
        pdfBase64,
        fileName
      });

      if (result.success) {
        toast({ title: "Distribution Complete", description: `Schedule emailed to ${recipientEmails.length} partners.` });
        setOpen(false);
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('Planner Distribution Error:', err);
      toast({ title: "Process Failed", description: "Failed to generate or send the schedule report.", variant: "destructive" });
    } finally {
      setIsDistributing(false);
    }
  };

  const toggleSubSelection = (id: string) => {
    setSelectedSubIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-primary border-primary/20 hover:bg-primary/5 h-10 w-10">
                <Send className="h-5 w-5" />
                <span className="sr-only">Distribute Schedule</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Email schedule to trade partners</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle>Distribute Site Schedule</DialogTitle>
          </div>
          <DialogDescription>
            Email a lookahead PDF to trade partners. Define the window of work to include.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">1. Report Range</Label>
            <RadioGroup value={scope} onValueChange={(v: any) => setScope(v)} className="grid grid-cols-2 gap-4">
                <div className={cn("p-4 rounded-xl border-2 transition-all cursor-pointer", scope === 'full' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30")} onClick={() => setScope('full')}>
                    <RadioGroupItem value="full" id="dist-full" className="sr-only" />
                    <Label htmlFor="dist-full" className="font-bold flex flex-col gap-1 cursor-pointer">
                        <span>All Activities</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Full timeline data.</span>
                    </Label>
                </div>
                <div className={cn("p-4 rounded-xl border-2 transition-all cursor-pointer", scope === 'range' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30")} onClick={() => setScope('range')}>
                    <RadioGroupItem value="range" id="dist-range" className="sr-only" />
                    <Label htmlFor="dist-range" className="font-bold flex flex-col gap-1 cursor-pointer">
                        <span>Focused Window</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Short-term lookahead.</span>
                    </Label>
                </div>
            </RadioGroup>

            {scope === 'range' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 pt-2">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">Start Date</Label>
                        <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase font-black text-muted-foreground ml-1">End Date</Label>
                        <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                    </div>
                </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">2. Select Recipients</Label>
            <ScrollArea className="h-48 rounded-lg border bg-muted/5 p-4">
              {subsInPlanner.length > 0 ? (
                <div className="space-y-3">
                  {subsInPlanner.map((sub) => {
                    const isChecked = selectedSubIds.includes(sub.id);
                    return (
                      <div key={sub.id} className="flex items-center space-x-3 group">
                        <Checkbox 
                          id={`sub-plan-${sub.id}`} 
                          checked={isChecked}
                          onCheckedChange={() => toggleSubSelection(sub.id)}
                        />
                        <div className="flex-1 flex flex-col cursor-pointer" onClick={() => toggleSubSelection(sub.id)}>
                          <Label htmlFor={`sub-plan-${sub.id}`} className="text-sm font-bold group-hover:text-primary transition-colors cursor-pointer">{sub.name}</Label>
                          <span className="text-[10px] text-muted-foreground">{sub.email}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-amber-500 opacity-50" />
                  <p className="text-xs text-muted-foreground">No trade partners assigned to tasks in this planner.</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isDistributing}>Cancel</Button>
          <Button 
            className="flex-1 h-11 px-8 font-bold gap-2 shadow-lg shadow-primary/20" 
            onClick={handleDistribute}
            disabled={isDistributing || selectedSubIds.length === 0 || (scope === 'range' && (!dateStart || !dateEnd))}
          >
            {isDistributing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Send Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
