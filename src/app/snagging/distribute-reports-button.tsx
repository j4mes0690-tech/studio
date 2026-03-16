'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Users, CheckCircle2, List, AlertTriangle, FileText } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { sendSubcontractorReportAction } from './actions';
import { cn, getPartnerEmails } from '@/lib/utils';
import { generateSnaggingPDF } from '@/lib/pdf-utils';

/**
 * DistributeReportsButton - Choose recipients and report scope before generating and emailing snagging PDFs.
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
  const [includeClosed, setIncludeClosed] = useState(false);
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
    let sentCount = 0;

    try {
      const area = project?.areas?.find(a => a.id === item.areaId);

      for (const subId of selectedSubIds) {
        const sub = subContractors.find(s => s.id === subId);
        if (!sub) continue;

        // Calculate distribution emails
        const recipientEmails = getPartnerEmails(subId, subContractors, allUsers);
        if (recipientEmails.length === 0) continue;

        // Determine items to include based on scope and status
        const itemsToInclude = item.items.filter(snag => {
            const isMyTrade = reportScope === 'individual' ? snag.subContractorId === subId : true;
            const isRelevantStatus = includeClosed ? true : snag.status === 'open';
            return isMyTrade && isRelevantStatus;
        });

        if (itemsToInclude.length === 0) continue;

        const fileName = 1; // Placeholder for logic clarity, actual implementation uses below:
        const reportFileName = `SnagReport-${sub.name.replace(/\s+/g, '-')}-${item.title.replace(/\s+/g, '-')}.pdf`;

        // Use the high-fidelity PDF engine
        const pdf = await generateSnaggingPDF({
          title: 'Snagging Audit Report',
          project,
          subContractors,
          aggregatedEntries: itemsToInclude.map(snag => ({
            listTitle: item.title,
            areaName: area?.name || 'General Site',
            snag
          })),
          generalPhotos: item.photos || [],
          scopeLabel: reportScope === 'individual' 
            ? `Partner: ${sub.name} ${includeClosed ? '(Audit)' : '(Outstanding)'}` 
            : `Full Area List ${includeClosed ? '(Audit)' : '(Outstanding)'}`
        });

        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // Broadcast to the whole partner distribution group
        for (const email of recipientEmails) {
            await sendSubcontractorReportAction({
              email,
              name: sub.name,
              projectName: project?.name || 'Project',
              areaName: area?.name || 'General Area',
              pdfBase64,
              fileName: reportFileName
            });
        }
        sentCount++;
      }

      if (sentCount === 0) {
        toast({
          title: "Nothing to Distribute",
          description: "No relevant items found for selected partners. Enable 'Include Completed Items' if you wish to send a full audit.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Process Complete", description: `Reports generated and issued to ${sentCount} partners.` });
        setOpen(false);
      }
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
            <p>Email reports to trade partners</p>
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
            Choose which partners to notify. Reports include site evidence and are sent to primary contacts and all assigned staff.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between p-3 rounded-lg border-2 border-primary/10 bg-primary/5">
            <div className="space-y-0.5">
                <Label className="text-sm font-bold text-primary">Include Completed Items</Label>
                <p className="text-[10px] text-muted-foreground">Include items already marked as fixed in the report.</p>
            </div>
            <Switch 
                checked={includeClosed} 
                onCheckedChange={setIncludeClosed} 
            />
          </div>

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
                    Partners only see the defects explicitly assigned to their company.
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
                    Partners see the entire list for this area. Their items are highlighted for clarity.
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
