'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CleanUpNotice, Project, SubContractor, DistributionUser } from '@/lib/types';
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
import { sendCleanUpNoticeEmailAction } from './actions';
import { cn, getPartnerEmails } from '@/lib/utils';

export function DistributeNoticeButton({
  notice,
  project,
  subContractors,
  allUsers,
}: {
  notice: CleanUpNotice;
  project?: Project;
  subContractors: SubContractor[];
  allUsers: DistributionUser[];
}) {
  const [open, setOpen] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();

  // Find unique subcontractors involved in this specific notice
  const subsInNotice = useMemo(() => {
    const ids = Array.from(new Set(notice.items.map(i => i.subContractorId).filter(id => !!id))) as string[];
    return subContractors.filter(s => ids.includes(s.id));
  }, [notice.items, subContractors]);

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedSubIds(subsInNotice.map(s => s.id));
    }
  };

  const handleDistribute = async () => {
    if (selectedSubIds.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please select at least one trade partner to receive the notice.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const area = project?.areas?.find(a => a.id === notice.areaId);

      for (const subId of selectedSubIds) {
        const sub = subContractors.find(s => s.id === subId);
        if (!sub) continue;

        // Get all recipient emails for this partner
        const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
        if (recipientEmails.length === 0) continue;

        const subItems = notice.items.filter(i => i.subContractorId === subId);
        
        // Generate PDF specifically for this subcontractor
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
            <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Clean Up Notice</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${notice.reference}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p><p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Project'}</p></div>
            <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area</p><p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p></div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Requirements for ${sub.name}</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${subItems.map(item => `<div style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><p style="margin: 0; font-size: 14px;">• ${item.description}</p></div>`).join('')}
            </div>
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

        // Send to each recipient in the group
        for (const email of recipientEmails) {
          await sendCleanUpNoticeEmailAction({
            email,
            name: sub.name,
            projectName: project?.name || 'Project',
            reference: notice.reference,
            pdfBase64,
            fileName: `CleanUpNotice-${notice.reference}.pdf`
          });
        }
      }

      toast({ title: "Distribution Complete", description: `Notice emailed to selected trade partners.` });
      setOpen(false);
    } catch (err) {
      console.error('Notice Distribution Error:', err);
      toast({ title: "Process Failed", description: "Failed to generate or send the notice report.", variant: "destructive" });
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
              <Button variant="ghost" size="icon" className="text-primary h-8 w-8">
                <Send className="h-4 w-4" />
                <span className="sr-only">Distribute Notice</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Email notice to trade partners</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle>Distribute Clean Up Notice</DialogTitle>
          </div>
          <DialogDescription>
            Select trade partners to receive their specific cleaning requirements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Recipients</Label>
            <ScrollArea className="h-48 rounded-lg border bg-muted/5 p-4">
              {subsInNotice.length > 0 ? (
                <div className="space-y-3">
                  {subsInNotice.map((sub) => {
                    const isChecked = selectedSubIds.includes(sub.id);
                    const partnerEmails = getPartnerEmails(sub.id, subContractors, allUsers);
                    return (
                      <div key={sub.id} className="flex items-center space-x-3 group">
                        <Checkbox 
                          id={`sub-not-${sub.id}`} 
                          checked={isChecked}
                          onCheckedChange={() => toggleSubSelection(sub.id)}
                        />
                        <div className="flex-1 flex flex-col cursor-pointer" onClick={() => toggleSubSelection(sub.id)}>
                          <Label htmlFor={`sub-not-${sub.id}`} className="text-sm font-bold group-hover:text-primary transition-colors cursor-pointer">{sub.name}</Label>
                          <span className="text-[10px] text-muted-foreground">{partnerEmails.length} recipients identified</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-amber-500 opacity-50" />
                  <p className="text-xs text-muted-foreground">No trade partners assigned to items in this notice.</p>
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
                Send Notice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
