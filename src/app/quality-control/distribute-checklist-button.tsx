'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import type { QualityChecklist, Project } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendChecklistEmailAction } from './actions';
import { generateQualityChecklistPDF } from '@/lib/pdf-utils';

/**
 * DistributeChecklistButton - Generates a professional sectional PDF of the QC checklist
 * and emails it to all recipients in the distribution list.
 */
export function DistributeChecklistButton({
  checklist,
  project,
}: {
  checklist: QualityChecklist;
  project?: Project;
}) {
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();

  const handleDistribute = async () => {
    const emails = checklist.recipients || [];
    
    if (emails.length === 0) {
      toast({
        title: "Distribution Cancelled",
        description: "No recipients assigned to this checklist.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const area = project?.areas?.find(a => a.id === checklist.areaId);
      const fileName = `QCReport-${checklist.title.replace(/\s+/g, '-')}-${area?.name.replace(/\s+/g, '-') || 'Site'}.pdf`;

      // Use the high-fidelity PDF engine
      const pdf = await generateQualityChecklistPDF(checklist, project);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      const result = await sendChecklistEmailAction({
        emails,
        projectName: project?.name || 'Project',
        areaName: area?.name || 'Site',
        checklistTitle: checklist.title,
        pdfBase64,
        fileName
      });

      if (result.success) {
        toast({ title: "Distribution Complete", description: result.message });
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('QC Distribution Error:', err);
      toast({ title: "Export Error", description: "Failed to create or send inspection report.", variant: "destructive" });
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleDistribute} disabled={isDistributing}>
            {isDistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Email report to trade partners</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Email PDF to Trade Partners</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
