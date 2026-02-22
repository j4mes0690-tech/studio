'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { SnaggingItem, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ExportButtonProps = {
  items: SnaggingItem[];
  projects: Project[];
};

export function ExportButton({
  items,
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
      'Project',
      'Area',
      'List Title',
      'Date',
      'Item Description',
      'Item Status',
      'Overall Photos',
    ];

    // Flatten lists into individual items for the CSV
    const rows: any[][] = [];

    items.forEach((list) => {
      const project = projectMap.get(list.projectId);
      const area = project?.areas?.find(a => a.id === list.areaId);
      const photoUrls = list.photos?.map(p => p.url).join('; ') || '';

      if (list.items && list.items.length > 0) {
          list.items.forEach(item => {
            rows.push([
                project?.name || 'N/A',
                area?.name || 'N/A',
                list.title,
                new Date(list.createdAt).toLocaleString(),
                item.description,
                item.status,
                photoUrls
            ]);
          });
      } else {
          // Fallback if no items (shouldn't happen with new schema)
          rows.push([
            project?.name || 'N/A',
            area?.name || 'N/A',
            list.title,
            new Date(list.createdAt).toLocaleString(),
            'No items recorded',
            'N/A',
            photoUrls
          ]);
      }
    });

    const csvContent = [
        headers.join(','), 
        ...rows.map((row) => row.map(escapeCsvCell).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `snagging-export-${new Date().toISOString().split('T')[0]}.csv`;
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
