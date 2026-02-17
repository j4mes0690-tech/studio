'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Instruction, Client, Project } from '@/lib/types';

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
      'Photo URL',
      'Photo Timestamp',
    ];

    const rows = instructions.map((instruction) => {
      const project = projectMap.get(instruction.projectId);
      const client = clientMap.get(instruction.clientId);
      return [
        project?.name || 'N/A',
        client?.name || 'N/A',
        new Date(instruction.createdAt).toLocaleString(),
        instruction.summary,
        instruction.actionItems.join('; '),
        instruction.recipients?.join('; ') || '',
        instruction.photo?.url || '',
        instruction.photo?.takenAt ? new Date(instruction.photo.takenAt).toLocaleString() : '',
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
    <Button variant="outline" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
