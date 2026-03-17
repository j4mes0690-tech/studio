'use client';

import { useState, useMemo, useTransition } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
    Download, 
    BarChart3, 
    CalendarRange, 
    Loader2, 
    FileText, 
    TrendingUp
} from 'lucide-react';
import type { SiteDiaryEntry, Project, SubContractor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { AttendanceGantt } from './attendance-gantt';
import { cn } from '@/lib/utils';
import { generateSiteDiaryAuditPDF } from '@/lib/pdf-utils';

export function SiteDiaryReports({ 
  entries, 
  projects, 
  subContractors,
  initialProjectId 
}: { 
  entries: SiteDiaryEntry[]; 
  projects: Project[]; 
  subContractors: SubContractor[];
  initialProjectId?: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportMode, setReportScope] = useState<'audit' | 'attendance'>('audit');
  
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectId, setProjectId] = useState<string>(initialProjectId || 'all');

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const date = parseISO(e.date);
      const start = startOfDay(parseISO(startDate));
      const end = endOfDay(parseISO(endDate));
      const withinRange = isWithinInterval(date, { start, end });
      const matchesProject = projectId === 'all' || e.projectId === projectId;
      return withinRange && matchesProject;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, startDate, endDate, projectId]);

  const handleExportPDF = async () => {
    if (filteredEntries.length === 0) {
      toast({ title: "No Data", description: "No diary records found for the selected criteria.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const project = projects.find(p => p.id === (projectId === 'all' ? filteredEntries[0].projectId : projectId));
      
      const pdf = await generateSiteDiaryAuditPDF(
        filteredEntries,
        project,
        subContractors
      );

      const fileName = `SiteDiaryAudit-${startDate}-to-${endDate}.pdf`;
      pdf.save(fileName);
      
      toast({ title: "Audit Complete", description: "The multi-page PDF report has been downloaded." });
      setOpen(false);
    } catch (err) {
      console.error('Audit PDF error:', err);
      toast({ title: "Export Failed", description: "Could not generate the audit PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 font-bold border-primary/20 text-primary hover:bg-primary/5">
          <BarChart3 className="h-4 w-4" />
          Reports & Analytics
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/10 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
                <CalendarRange className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle className="text-xl">Site Analytics & Distribution</DialogTitle>
                <DialogDescription>Consolidate site data for commercial audits or visual attendance tracking.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-xl border border-dashed">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-background h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Authorised Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 bg-background" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setReportScope('audit')}
                        className={cn(
                            "pb-2 text-xs font-black uppercase tracking-widest transition-colors relative",
                            reportMode === 'audit' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Commercial Audit
                    </button>
                    <button 
                        onClick={() => setReportScope('attendance')}
                        className={cn(
                            "pb-2 text-xs font-black uppercase tracking-widest transition-colors relative",
                            reportMode === 'attendance' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Attendance Visualiser
                    </button>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">{filteredEntries.length} entries in scope</Badge>
            </div>

            {reportMode === 'audit' ? (
                <div className="space-y-6 py-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                        <FileText className="h-16 w-16 text-muted-foreground/20" />
                        <div className="space-y-1">
                            <h4 className="font-bold">Commercial Audit Report (PDF)</h4>
                            <p className="text-sm text-muted-foreground max-w-sm">Generates a high-fidelity multi-page document. Includes one page per diary entry with full weather data, labour logs, and high-resolution site documentation.</p>
                        </div>
                        <Button 
                            className="h-12 px-8 gap-2 font-bold shadow-lg shadow-primary/20" 
                            onClick={handleExportPDF}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Download Audit PDF
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="py-4 animate-in fade-in slide-in-from-top-2">
                    {filteredEntries.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-primary bg-primary/5 px-3 py-1.5 rounded-full w-fit">
                                <TrendingUp className="h-3.5 w-3.5" />
                                Interactive Site Presence Map
                            </div>
                            <AttendanceGantt 
                                entries={filteredEntries} 
                                subContractors={subContractors}
                            />
                        </div>
                    ) : (
                        <div className="py-20 text-center border-2 border-dashed rounded-xl opacity-40">
                            <p className="text-sm font-medium">No diary records found for the selected parameters.</p>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t shrink-0">
            <Button variant="outline" className="w-full font-bold" onClick={() => setOpen(false)}>Close Analytics</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
