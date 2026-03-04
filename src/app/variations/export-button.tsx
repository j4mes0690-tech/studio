'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Variation, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ExportButtonProps = {
  variations: Variation[];
  projects: Project[];
};

export function ExportButton({
  variations,
  projects,
}: ExportButtonProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const escapeCsvCell = (cell: string) => {
    if (!cell) return '""';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = () => {
    const headers = [
      'Reference',
      'Project',
      'Title',
      'Status',
      'Net Value',
      'Date Created',
      'CI Link',
      'SI Link',
    ];

    const rows = variations.map((v) => {
      const project = projectMap.get(v.projectId);
      return [
        v.reference,
        project?.name || 'N/A',
        v.title,
        v.status,
        v.totalAmount.toFixed(2),
        new Date(v.createdAt).toLocaleDateString(),
        v.clientInstructionId || 'None',
        v.siteInstructionId || 'None',
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `variations-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleExport}>
            <Download className="h-5 w-5" />
            <span className="sr-only">Export CSV</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export Variations CSV</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
