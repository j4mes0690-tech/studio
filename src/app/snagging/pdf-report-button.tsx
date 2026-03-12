
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { generateSnaggingPDF } from '@/lib/pdf-utils';

export function PdfReportButton({
  item,
  project,
  subContractors,
}: {
  item: SnaggingItem;
  project?: Project;
  subContractors: SubContractor[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const area = project?.areas?.find(a => a.id === item.areaId);
      const aggregatedEntries = item.items.map(snag => ({
        listTitle: item.title,
        areaName: area?.name || 'General Site',
        snag
      }));

      const pdf = await generateSnaggingPDF({
        title: 'Snagging Report',
        project,
        subContractors,
        aggregatedEntries,
        generalPhotos: item.photos || []
      });

      pdf.save(`snagging-report-${item.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('Snagging PDF Generation Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleDownload} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="sr-only">Export PDF Report</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export PDF Report</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
