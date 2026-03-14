
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
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
      // 1. Generate the PDF
      const pdf = await generatePlannerPDF(tasks, project, planner, subContractors);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      const fileName = `Schedule-${project?.name.replace(/\s+/g, '-')}-${planner?.name.replace(/\s+/g, '-')}.pdf`;

      // 2. Get recipient emails
      const recipientEmails = subContractors
        .filter(s => selectedSubIds.includes(s.id))
        .map(s => s.email);

      // 3. Send via Resend
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

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle>Distribute Site Schedule</DialogTitle>
          </div>
          <DialogDescription>
            Email the latest lookahead PDF to the trade partners involved in this planner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Recipients</Label>
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
            disabled={isDistributing || selectedSubIds.length === 0}
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
