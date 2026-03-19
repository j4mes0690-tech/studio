'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { SubContractOrder, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { generateSubContractOrdersPDF } from '@/lib/pdf-utils';

type ExportButtonsProps = {
  items: SubContractOrder[];
  project?: Project;
};

export function ExportButtons({
  items,
  project,
}: ExportButtonsProps) {
  const { toast } = useToast();
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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
      'Sub-contractor',
      'Description',
      'Status',
      'Drafted Date',
      'Approval Sent',
      'DocuSign Date',
      'Signed Date',
      'Created At'
    ];

    const rows = items.map((item) => {
      return [
        item.reference,
        item.subcontractorName,
        item.description,
        item.status,
        item.draftedDate || '---',
        item.sentForApprovalDate || '---',
        item.loadedOnDocuSignDate || '---',
        item.signedDate || '---',
        new Date(item.createdAt).toLocaleString(),
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.href = url;
    link.download = `subcontract-log-${project?.name.replace(/\s+/g, '-') || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: 'CSV Downloaded', description: 'Agreement tracker export is ready.' });
  };

  const handleExportPDF = async () => {
    if (items.length === 0) return;
    setIsPdfGenerating(true);
    try {
      const pdf = await generateSubContractOrdersPDF(items, project);
      pdf.save(`SubContractTracker-${project?.name.replace(/\s+/g, '-') || 'export'}.pdf`);
      toast({ title: 'PDF Ready', description: 'The formal tracking schedule has been exported.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF report.', variant: 'destructive' });
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
            <p>Export Formal PDF Tracker</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
