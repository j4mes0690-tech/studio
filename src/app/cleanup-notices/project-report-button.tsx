'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download, CheckCircle2, LayoutGrid, Users, Filter, Building2, Send, Check } from 'lucide-react';
import type { CleanUpNotice, Project, SubContractor, Photo } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { sendCleanUpReportAction } from './actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { generateCleanUpPDF } from '@/lib/pdf-utils';

export function ProjectReportButton({
  projects,
  allNotices,
  subContractors,
  initialProjectId,
}: {
  projects: Project[];
  allNotices: CleanUpNotice[];
  subContractors: SubContractor[];
  initialProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [reportType, setReportType] = useState<'global' | 'partner'>('global');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedSubId, setSelectedSubId] = useState<string>(''); 
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]); 
  const { toast } = useToast();

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const activeProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectNotices = useMemo(() => {
    if (!selectedProjectId) return [];
    return allNotices.filter(n => n.projectId === selectedProjectId);
  }, [allNotices, selectedProjectId]);

  const subsInProject = useMemo(() => {
    if (!selectedProjectId) return [];
    const ids = new Set<string>();
    projectNotices.forEach(notice => {
      notice.items.forEach(item => {
        if (item.subContractorId) ids.add(item.subContractorId);
      });
    });
    return subContractors.filter(s => ids.has(s.id));
  }, [projectNotices, selectedProjectId, subContractors]);

  useEffect(() => {
    if (reportType === 'partner' && selectedSubId) {
      setSelectedRecipientIds([selectedSubId]);
    } else if (reportType === 'partner') {
      setSelectedRecipientIds([]);
    }
  }, [reportType, selectedSubId]);

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAction = async (mode: 'download' | 'email') => {
    if (!activeProject) return;
    
    if (mode === 'download') setIsGenerating(true);
    else setIsDistributing(true);

    try {
      // 1. Aggregation Logic
      const aggregatedEntries: { listTitle: string, areaName: string, item: any }[] = [];
      projectNotices.forEach(notice => {
        const area = activeProject.areas?.find(a => a.id === notice.areaId);
        notice.items.forEach(item => {
          if (reportType === 'partner' && item.subContractorId !== selectedSubId) return;
          aggregatedEntries.push({
            listTitle: notice.title,
            areaName: area?.name || 'General Site',
            item
          });
        });
      });

      if (aggregatedEntries.length === 0) {
        toast({ title: "Report Empty", description: "No items match your criteria.", variant: "destructive" });
        return;
      }

      // 2. Generate PDF
      const scopeLabel = reportType === 'partner' ? subContractors.find(s => s.id === selectedSubId)?.name : 'All Trade Disciplines';
      const pdf = await generateCleanUpPDF({
        title: 'Project Clean Up Audit',
        project: activeProject,
        subContractors,
        aggregatedEntries,
        generalPhotos: projectNotices.flatMap(n => n.photos || []),
        scopeLabel
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `CleanUpAudit-${activeProject.name.replace(/\s+/g, '-')}-${timestamp}.pdf`;

      if (mode === 'download') {
        pdf.save(fileName);
        toast({ title: "Success", description: "Project report generated." });
      } else {
        const recipients = subContractors.filter(s => selectedRecipientIds.includes(s.id));
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        
        let successCount = 0;
        for (const sub of recipients) {
          const result = await sendCleanUpReportAction({
            email: sub.email,
            name: sub.name,
            projectName: activeProject.name,
            pdfBase64,
            fileName
          });
          if (result.success) successCount++;
        }
        toast({ title: "Distribution Complete", description: `Emailed to ${successCount} partners.` });
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Generation Error", description: "Failed to build high-fidelity PDF report.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setIsDistributing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold h-9 px-2 sm:px-4">
          <FileText className="h-4 w-4" />
          <span className="hidden xs:inline">Project Reports</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <DialogTitle>Aggregated Reporting</DialogTitle>
          </div>
          <DialogDescription>Consolidate cleaning requirements across multiple site lists into one high-fidelity audit.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">1. Target Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-background h-11 border-primary/20">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose project..." />
                </div>
              </SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {selectedProjectId && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">2. Reporting Strategy</Label>
                <RadioGroup value={reportType} onValueChange={(v: any) => setReportType(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cn("flex items-start space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all", reportType === 'global' ? "border-primary bg-primary/5 shadow-md" : "border-muted hover:border-muted-foreground/30")} onClick={() => setReportType('global')}>
                    <RadioGroupItem value="global" id="ct-global" className="mt-1" />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="ct-global" className="text-sm font-bold flex items-center gap-2 cursor-pointer"><Filter className="h-3.5 w-3.5" /> Full Audit</Label>
                      <p className="text-[10px] text-muted-foreground">Every outstanding item in the project.</p>
                    </div>
                  </div>
                  <div className={cn("flex items-start space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all", reportType === 'partner' ? "border-primary bg-primary/5 shadow-md" : "border-muted hover:border-muted-foreground/30")} onClick={() => setReportType('partner')}>
                    <RadioGroupItem value="partner" id="ct-partner" className="mt-1" />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="ct-partner" className="text-sm font-bold flex items-center gap-2 cursor-pointer"><Users className="h-3.5 w-3.5" /> Partner Specific</Label>
                      <p className="text-[10px] text-muted-foreground">Filter by a single trade partner.</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {reportType === 'partner' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">3. Lead Partner</Label>
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger className="bg-background h-11"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                    <SelectContent>{subsInProject.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Distribution</Label>
                <ScrollArea className="h-40 rounded-xl border bg-muted/5 p-4">
                    <div className="space-y-3">
                        {subsInProject.map((sub) => {
                            const isChecked = selectedRecipientIds.includes(sub.id);
                            return (
                                <div key={sub.id} className={cn("flex items-center space-x-3 p-2 rounded-lg border border-transparent transition-all", isChecked ? "bg-background border-border shadow-sm" : "opacity-70")}>
                                    <Checkbox id={`cr-rec-${sub.id}`} checked={isChecked} disabled={reportType === 'partner' && selectedSubId !== sub.id} onCheckedChange={() => toggleRecipient(sub.id)} />
                                    <div className="flex-1 flex flex-col cursor-pointer" onClick={() => reportType === 'global' && toggleRecipient(sub.id)}>
                                        <Label htmlFor={`cr-rec-${sub.id}`} className="text-sm font-bold cursor-pointer">{sub.name}</Label>
                                        <span className="text-[10px] text-muted-foreground">{sub.email}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button variant="ghost" className="font-bold text-muted-foreground order-last sm:order-first" onClick={() => setOpen(false)}>Cancel</Button>
                <div className="hidden sm:block flex-1" />
                <Button variant="outline" className="h-12 px-6 font-bold gap-2 border-primary/30 text-primary" onClick={() => handleAction('email')} disabled={isGenerating || isDistributing || selectedRecipientIds.length === 0}>
                  {isDistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Distribute
                </Button>
                <Button className="h-12 px-8 font-bold gap-2 shadow-lg shadow-primary/20" onClick={() => handleAction('download')} disabled={isGenerating || isDistributing}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
