
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
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const handleExport = () => {
    const headers = [
      'Project',
      'Date',
      'Description',
      'Recipients',
      'Photo URLs',
      'Photo Timestamps',
    ];

    const rows = notices.map((notice) => {
      const project = projectMap.get(notice.projectId);
      const photoUrls = notice.photos?.map(p => p.url).join('; ') || '';
      const photoTimestamps = notice.photos?.map(p => new Date(p.takenAt).toLocaleString()).join('; ') || '';

      return [
        project?.name || 'N/A',
        new Date(notice.createdAt).toLocaleString(),
        notice.description,
        notice.recipients?.join('; ') || '',
        photoUrls,
        photoTimestamps,
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
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
