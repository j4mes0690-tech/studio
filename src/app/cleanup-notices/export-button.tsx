'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { CleanUpNotice, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ExportButtonProps = {
  notices: CleanUpNotice[];
  projects: Project[];
};

export function ExportButton({
  notices,
  projects,
}: ExportButtonProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const escapeCsvCell = (cell: string) => {
    if (!cell) return '""';
    const cellStr = String(cell);
    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  };

  const handleExport = () => {
    const headers = [
      'Reference',
      'Project',
      'Area',
      'List Title',
      'Date',
      'Item Description',
      'Item Status',
      'Assigned Subcontractor',
    ];

    const rows: any[][] = [];

    notices.forEach((notice) => {
      const project = projectMap.get(notice.projectId);
      const area = project?.areas?.find(a => a.id === notice.areaId);

      if (notice.items && notice.items.length > 0) {
          notice.items.forEach(item => {
            rows.push([
                notice.reference,
                project?.name || 'N/A',
                area?.name || 'N/A',
                notice.title,
                new Date(notice.createdAt).toLocaleString(),
                item.description,
                item.status,
                item.subContractorId || 'Unassigned'
            ]);
          });
      } else {
          rows.push([
            notice.reference,
            project?.name || 'N/A',
            area?.name || 'N/A',
            notice.title,
            new Date(notice.createdAt).toLocaleString(),
            'No items recorded',
            'N/A',
            'N/A'
          ]);
      }
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `cleanup-notices-export-${new Date().toISOString().split('T')[0]}.csv`;
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
          <p>Export CSV</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
