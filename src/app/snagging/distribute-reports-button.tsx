'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Users, FileText, CheckCircle2, List, AlertTriangle } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor, DistributionUser } from '@/lib/types';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { sendSubcontractorReportAction } from './actions';
import { cn, getPartnerEmails } from '@/lib/utils';

/**
 * DistributeReportsButton - Provides a prompt to choose recipients and report scope
 * before generating and emailing snagging PDFs via Resend.
 * Now distributes to all associated partner users who have the email flag set.
 */
export function DistributeReportsButton({
  item,
  project,
  subContractors,
  allUsers,
}: {
  item: SnaggingItem;
  project?: Project;
  subContractors: SubContractor[];
  allUsers: DistributionUser[];
}) {
  const [open, setOpen] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [reportScope, setReportScope] = useState<'individual' | 'full'>('individual');
  const { toast } = useToast();

  // Find unique subcontractors involved in this list
  const subsInList = useMemo(() => {
    const ids = Array.from(new Set(item.items.map(i => i.subContractorId).filter(id => !!id))) as string[];
    return subContractors.filter(s => ids.includes(s.id));
  }, [item.items, subContractors]);

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  // Initialize selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedSubIds(subsInList.map(s => s.id));
    }
  };

  const handleDistribute = async () => {
    if (selectedSubIds.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one trade partner to receive the report.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      for (const subId of selectedSubIds) {
        const sub = subContractors.find(s => s.id === subId);
        if (!sub) continue;

        // Calculate distribution emails (Primary Sub Email + Assigned Users)
        const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
        if (recipientEmails.length === 0) continue;

        // Determine items to include based on scope
        const itemsToInclude = reportScope === 'individual' 
          ? item.items.filter(i => i.subContractorId === subId)
          : item.items;

        const area = project?.areas?.find(a => a.id === item.areaId);
        const formattedDate = new Date(item.createdAt).toLocaleDateString();
        const fileName = `SnagReport-${sub.name.replace(/\s+/g, '-')}-${item.title.replace(/\s+/g, '-')}.pdf`;

        const reportElement = document.createElement('div');
        reportElement.style.position = 'absolute';
        reportElement.style.left = '-9999px';
        reportElement.style.padding = '40px';
        reportElement.style.width = '800px';
        reportElement.style.background = 'white';
        reportElement.style.color = 'black';
        reportElement.style.fontFamily = 'sans-serif';

        reportElement.innerHTML = `
          <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Snagging Report</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Partner: ${sub.name}</p>
            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              ${reportScope === 'individual' ? 'Scope: Individual Trade Items Only' : 'Scope: Full Area Completion List'}
            </p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p>
              <p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Unknown Project'}</p>
            </div>
            <div>
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area</p>
              <p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p>
            </div>
          </div>

          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
            ${reportScope === 'individual' ? 'Assigned Trade Items' : 'Comprehensive List'}
          </h2>
          
          <div style="margin-bottom: 40px;">
            ${itemsToInclude.map(listItem => {
              const itemSub = subContractors.find(s => s.id === listItem.subContractorId);
              const isAssignedToThisRecipient = listItem.subContractorId === subId;
              const hasIssuePhotos = listItem.photos && listItem.photos.length > 0;
              const hasCompletionPhotos = listItem.completionPhotos && listItem.completionPhotos.length > 0;
              
              return `
                <div style="border: 1px solid ${isAssignedToThisRecipient ? '#1e40af' : '#e2e8f0'}; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; background: ${isAssignedToThisRecipient ? '#f0f7ff' : 'transparent'};">
                  <div style="background: ${isAssignedToThisRecipient ? '#e0f2fe' : '#f8fafc'}; padding: 12px; border-bottom: 1px solid ${isAssignedToThisRecipient ? '#1e40af' : '#e2e8f0'}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                      <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1e293b;">${listItem.description}</p>
                      ${reportScope === 'full' ? `<p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: bold;">Trade: ${itemSub?.name || 'Unassigned'}</p>` : ''}
                    </div>
                    <div style="background: ${listItem.status === 'closed' ? '#dcfce7' : '#fef3c7'}; color: ${listItem.status === 'closed' ? '#166534' : '#92400e'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                      ${listItem.status}
                    </div>
                  </div>
                  
                  <div style="padding: 12px;">
                    ${hasIssuePhotos ? `
                      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
                        ${listItem.photos!.map(p => `<img src="${p.url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;" />`).join('')}
                      </div>
                    ` : ''}

                    ${hasCompletionPhotos ? `
                      <p style="margin: 0 0 5px 0; font-size: 8px; color: #16a34a; font-weight: bold; text-transform: uppercase;">Verification Evidence</p>
                      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        ${listItem.completionPhotos!.map(p => `<img src="${p.url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #dcfce7;" />`).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 12px; color: #64748b;">Report generated on ${formattedDate} via SiteCommand.</p>
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

        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // Broadcast to the whole partner distribution group
        for (const email of recipientEmails) {
            await sendSubcontractorReportAction({
              email,
              name: sub.name,
              projectName: project?.name || 'Project',
              areaName: area?.name || 'General Area',
              pdfBase64,
              fileName
            });
        }
      }

      toast({ title: "Process Complete", description: "All selected trade reports have been issued to the full distribution list." });
      setOpen(false);
    } catch (err) {
      console.error('Distribution Error:', err);
      toast({ title: "Process Failed", description: "Unexpected error during report generation.", variant: "destructive" });
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
              <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5">
                <Send className="h-4 w-4" />
                <span className="sr-only">Email reports</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Distribute reports to trade partners</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle>Distribute Snagging Reports</DialogTitle>
          </div>
          <DialogDescription>
            Choose which partners to notify. Reports are sent to primary contacts and all assigned staff with email preferences enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Trade Partners</Label>
            <ScrollArea className="h-48 rounded-lg border bg-muted/5 p-4">
              {subsInList.length > 0 ? (
                <div className="space-y-3">
                  {subsInList.map((sub) => {
                    const itemWeight = item.items.filter(i => i.subContractorId === sub.id).length;
                    const partnerEmails = getPartnerEmails(sub.id, subContractors, allUsers);
                    return (
                      <div key={sub.id} className="flex items-center space-x-3 group">
                        <Checkbox 
                          id={`sub-${sub.id}`} 
                          checked={selectedSubIds.includes(sub.id)}
                          onCheckedChange={() => toggleSubSelection(sub.id)}
                        />
                        <div className="flex-1 flex flex-col cursor-pointer" onClick={() => toggleSubSelection(sub.id)}>
                          <Label htmlFor={`sub-${sub.id}`} className="text-sm font-bold group-hover:text-primary transition-colors cursor-pointer">{sub.name}</Label>
                          <span className="text-[10px] text-muted-foreground">{itemWeight} items assigned • {partnerEmails.length} recipients</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-amber-500 opacity-50" />
                  <p className="text-xs text-muted-foreground">No subcontractors are assigned to items in this list.</p>
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Report Format</Label>
            <RadioGroup value={reportScope} onValueChange={(v: any) => setReportScope(v)} className="grid grid-cols-1 gap-2">
              <div 
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                  reportScope === 'individual' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => setReportScope('individual')}
              >
                <RadioGroupItem value="individual" id="r-ind" className="mt-1" />
                <div className="flex flex-col gap-1">
                  <Label htmlFor="r-ind" className="text-sm font-bold flex items-center gap-2 cursor-pointer"><List className="h-3.5 w-3.5" /> Individual Trade Items</Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Partners only see the defects explicitly assigned to their company. Minimalist and focused.
                  </p>
                </div>
              </div>

              <div 
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                  reportScope === 'full' ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"
                )}
                onClick={() => setReportScope('full')}
              >
                <RadioGroupItem value="full" id="r-full" className="mt-1" />
                <div className="flex flex-col gap-1">
                  <Label htmlFor="r-full" className="text-sm font-bold flex items-center gap-2 cursor-pointer"><FileText className="h-3.5 w-3.5" /> Full Area Completion List</Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Partners see the entire list for this area. Their items are highlighted for clarity. Best for site-wide context.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isDistributing}>Cancel</Button>
          <Button 
            className="flex-1 sm:flex-none h-11 px-8 font-bold gap-2 shadow-lg shadow-primary/20" 
            onClick={handleDistribute}
            disabled={isDistributing || selectedSubIds.length === 0}
          >
            {isDistributing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Reports...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Distribute Reports
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
