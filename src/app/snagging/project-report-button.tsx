'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download, CheckCircle2, LayoutGrid, Users, Filter, Building2 } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
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
import { cn } from '@/lib/utils';

/**
 * ProjectReportButton - A reporting center accessible from the Snagging Log.
 * Allows generating aggregated PDF reports across multiple lists for a project.
 */
export function ProjectReportButton({
  projects,
  allSnaggingLists,
  subContractors,
  initialProjectId,
}: {
  projects: Project[];
  allSnaggingLists: SnaggingItem[];
  subContractors: SubContractor[];
  initialProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<'global' | 'partner'>('global');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedSubId, setSelectedSubId] = useState<string>('all');
  const { toast } = useToast();

  // Sync state if initial project changes via filter
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  const activeProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectLists = useMemo(() => {
    if (!selectedProjectId) return [];
    return allSnaggingLists.filter(l => l.projectId === selectedProjectId);
  }, [allSnaggingLists, selectedProjectId]);

  const subsInProject = useMemo(() => {
    if (!selectedProjectId) return [];
    const ids = new Set<string>();
    projectLists.forEach(list => {
      list.items.forEach(item => {
        if (item.subContractorId) ids.add(item.subContractorId);
      });
    });
    return subContractors.filter(s => ids.has(s.id));
  }, [projectLists, selectedProjectId, subContractors]);

  const generatePdf = async () => {
    if (!activeProject) return;
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Aggregating all items based on filter
      let aggregatedItems: { listTitle: string, areaName: string, snag: any }[] = [];
      
      projectLists.forEach(list => {
        const area = activeProject.areas?.find(a => a.id === list.areaId);
        list.items.forEach(item => {
          if (reportType === 'partner' && item.subContractorId !== selectedSubId) return;
          aggregatedItems.push({
            listTitle: list.title,
            areaName: area?.name || 'General Site',
            snag: item
          });
        });
      });

      if (aggregatedItems.length === 0) {
        toast({ title: "Report Empty", description: "No snagging items found for this selection.", variant: "destructive" });
        setIsGenerating(false);
        return;
      }

      const reportElement = document.createElement('div');
      reportElement.style.padding = '40px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      const partnerName = reportType === 'partner' ? subContractors.find(s => s.id === selectedSubId)?.name : 'All Trade Disciplines';

      reportElement.innerHTML = `
        <div style="border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">PROJECT AGGREGATED SNAG REPORT</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Project: ${activeProject.name}</p>
          <p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Scope: ${partnerName}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Contract Authority</p>
            <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold;">${activeProject.siteManager || '---'}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Export Date</p>
            <p style="margin: 2px 0 0 0; font-size: 14px;">${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          ${aggregatedItems.map(({ listTitle, areaName, snag }) => {
            const itemSub = subContractors.find(s => s.id === snag.subContractorId);
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid;">
                <div style="background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <div style="flex: 1;">
                    <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1e293b;">${snag.description}</p>
                    <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: bold;">Trade: ${itemSub?.name || 'Unassigned'}</p>
                    <p style="margin: 2px 0 0 0; font-size: 9px; color: #94a3b8;">Area: ${areaName} | ${listTitle}</p>
                  </div>
                  <div style="background: ${snag.status === 'closed' ? '#dcfce7' : snag.status === 'provisionally-complete' ? '#fef3c7' : '#fee2e2'}; color: ${snag.status === 'closed' ? '#166534' : snag.status === 'provisionally-complete' ? '#92400e' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                    ${snag.status.replace('-', ' ')}
                  </div>
                </div>
                <div style="padding: 12px;">
                  ${(snag.photos && snag.photos.length > 0) || (snag.completionPhotos && snag.completionPhotos.length > 0) ? `
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      ${(snag.photos || []).map(p => `<img src="${p.url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;" />`).join('')}
                      ${(snag.completionPhotos || []).map(p => `<img src="${p.url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; border: 2px solid #dcfce7;" />`).join('')}
                    </div>
                  ` : '<p style="margin: 0; font-size: 10px; color: #94a3b8; font-style: italic;">No visual evidence recorded.</p>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 12px; color: #64748b;">This project-wide summary was generated via SiteCommand.</p>
        </div>
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`ProjectSnagging-${activeProject.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: "Report Ready", description: "The aggregated project snag report has been generated." });
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to generate aggregated report.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold h-9">
          <FileText className="h-4 w-4" />
          Project Reports
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <DialogTitle>Aggregated Snagging Wizard</DialogTitle>
          </div>
          <DialogDescription>
            Generate combined reports across multiple areas and trades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">1. Select Target Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-background h-11 border-primary/20">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose project..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId && (
            <>
              <Separator />
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. Choose Report Strategy</Label>
                <RadioGroup value={reportType} onValueChange={(v: any) => setReportType(v)} className="grid grid-cols-1 gap-2">
                  <div 
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                      reportType === 'global' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                    )}
                    onClick={() => setReportType('global')}
                  >
                    <RadioGroupItem value="global" id="rt-global" className="mt-1" />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="rt-global" className="text-sm font-bold flex items-center gap-2 cursor-pointer">
                        <Filter className="h-3.5 w-3.5" /> Full Project Audit
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Includes all recorded defects across every area and trade in the project.
                      </p>
                    </div>
                  </div>

                  <div 
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                      reportType === 'partner' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                    )}
                    onClick={() => setReportType('partner')}
                  >
                    <RadioGroupItem value="partner" id="rt-partner" className="mt-1" />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="rt-partner" className="text-sm font-bold flex items-center gap-2 cursor-pointer">
                        <Users className="h-3.5 w-3.5" /> Targeted Trade Report
                      </Label>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Consolidates only the defects assigned to a specific trade partner across the whole site.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {reportType === 'partner' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">3. Select Trade Partner</Label>
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger className="bg-background h-11 border-primary/20">
                      <SelectValue placeholder="Select a trade partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subsInProject.length > 0 ? subsInProject.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      )) : (
                        <div className="p-2 text-xs text-muted-foreground italic text-center">No assigned partners found.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isGenerating}>Cancel</Button>
          <Button 
            className="flex-1 sm:flex-none h-11 px-8 font-bold gap-2 shadow-lg shadow-primary/20" 
            onClick={generatePdf}
            disabled={isGenerating || !selectedProjectId || (reportType === 'partner' && (selectedSubId === 'all' || !selectedSubId))}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Report...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
