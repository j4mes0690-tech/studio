
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Instruction, Client, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ExportButtonProps = {
  instructions: Instruction[];
  clients: Client[];
  projects: Project[];
};

export function ExportButton({
  instructions,
  clients,
  projects,
}: ExportButtonProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

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
      'Client',
      'Date',
      'Summary',
      'Action Items',
      'Recipients',
      'Photo URLs',
      'Photo Timestamps',
    ];

    const rows = instructions.map((instruction) => {
      const project = projectMap.get(instruction.projectId);
      const client = clientMap.get(instruction.clientId);
      const photoUrls = instruction.photos?.map(p => p.url).join('; ') || '';
      const photoTimestamps = instruction.photos?.map(p => new Date(p.takenAt).toLocaleString()).join('; ') || '';
      
      return [
        project?.name || 'N/A',
        client?.name || 'N/A',
        new Date(instruction.createdAt).toLocaleString(),
        instruction.summary,
        instruction.actionItems.join('; '),
        instruction.recipients?.join('; ') || '',
        photoUrls,
        photoTimestamps,
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `instructions-export-${new Date().toISOString().split('T')[0]}.csv`;
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
