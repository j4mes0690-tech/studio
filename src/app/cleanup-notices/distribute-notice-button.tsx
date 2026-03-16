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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { sendCleanUpNoticeEmailAction } from './actions';
import { getPartnerEmails } from '@/lib/utils';
import { generateCleanUpPDF } from '@/lib/pdf-utils';

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
  const [includeClosed, setIncludeClosed] = useState(false);
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
      const area = project?.areas?.find(a => a.id === notice.areaId);

      for (const subId of selectedSubIds) {
        const sub = subContractors.find(s => s.id === subId);
        if (!sub) continue;

        // Get all recipient emails for this partner
        const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
        if (recipientEmails.length === 0) continue;

        // Filter items based on user selection
        const subItems = notice.items.filter(i => {
            const isMyTrade = i.subContractorId === subId;
            const isRelevantStatus = includeClosed ? true : i.status === 'open';
            return isMyTrade && isRelevantStatus;
        });

        if (subItems.length === 0) continue;
        
        // Generate high-fidelity PDF specifically for this subcontractor using the shared engine
        const pdf = await generateCleanUpPDF({
          title: 'Clean Up Notice',
          project,
          subContractors,
          aggregatedEntries: subItems.map(item => ({
            listTitle: notice.title,
            areaName: area?.name || 'General Site',
            item
          })),
          generalPhotos: notice.photos || [],
          scopeLabel: `Trade: ${sub.name}${includeClosed ? ' (Full Audit)' : ' (Outstanding Items Only)'}`
        });

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

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg border-2 border-primary/10 bg-primary/5">
            <div className="space-y-0.5">
                <Label className="text-sm font-bold text-primary">Include Completed Items</Label>
                <p className="text-[10px] text-muted-foreground">Toggle to include cleared items in the report.</p>
            </div>
            <Switch 
                checked={includeClosed} 
                onCheckedChange={setIncludeClosed} 
            />
          </div>

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
