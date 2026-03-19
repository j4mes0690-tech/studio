'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { ProcurementItem, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { generateProcurementPDF } from '@/lib/pdf-utils';

type ExportButtonsProps = {
  items: ProcurementItem[];
  project?: Project;
  projects: Project[];
};

export function ExportButtons({
  items,
  project,
  projects
}: ExportButtonsProps) {
  const { toast } = useToast();
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const escapeCsvCell = (cell: string | number | null | undefined) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = () => {
    const headers = [
      'Reference',
      'Project',
      'Trade Discipline',
      'Appointed Partner',
      'Warranty Required',
      'Target Enquiry Date',
      'Actual Enquiry Date',
      'Tender Return Date',
      'Latest Date for Order',
      'Order Placed Date',
      'Start on Site Date',
      'Status',
      'Comments'
    ];

    const rows = items.map((item) => {
      const p = projectMap.get(item.projectId);
      return [
        item.reference,
        p?.name || 'N/A',
        item.trade,
        item.subcontractorName || 'TBC',
        item.warrantyRequired ? 'Yes' : 'No',
        item.targetEnquiryDate,
        item.actualEnquiryDate || '---',
        item.tenderReturnDate || '---',
        item.latestDateForOrder || '---',
        item.orderPlacedDate || '---',
        item.startOnSiteDate || '---',
        item.status,
        item.comments || ''
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.href = url;
    link.download = `procurement-schedule-${project?.name.replace(/\s+/g, '-') || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: 'CSV Downloaded', description: 'Procurement extract is ready.' });
  };

  const handleExportPDF = async () => {
    if (items.length === 0) return;
    setIsPdfGenerating(true);
    try {
      const pdf = await generateProcurementPDF(items, project);
      pdf.save(`ProcurementSchedule-${project?.name.replace(/\s+/g, '-') || 'export'}.pdf`);
      toast({ title: 'PDF Ready', description: 'The formal schedule has been exported.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF schedule.', variant: 'destructive' });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleExportCSV} className="h-9 w-9 text-muted-foreground hover:text-primary">
              <Download className="h-4 w-4" />
              <span className="sr-only">Export CSV</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export CSV Data</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleExportPDF} disabled={isPdfGenerating} className="h-9 w-9 text-muted-foreground hover:text-primary">
              {isPdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              <span className="sr-only">Export PDF Report</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export Formal PDF Schedule</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
