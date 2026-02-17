
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { SnaggingItem, Client, Project } from '@/lib/types';

type ExportButtonProps = {
  items: SnaggingItem[];
  clients: Client[];
  projects: Project[];
};

export function ExportButton({
  items,
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
      'Description',
      'Photo URL',
      'Photo Timestamp',
    ];

    const rows = items.map((item) => {
      const project = projectMap.get(item.projectId);
      const client = clientMap.get(item.clientId);
      return [
        project?.name || 'N/A',
        client?.name || 'N/A',
        new Date(item.createdAt).toLocaleString(),
        item.description,
        item.photo?.url || '',
        item.photo?.takenAt ? new Date(item.photo.takenAt).toLocaleString() : '',
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `snagging-list-export-${new Date().toISOString().split('T')[0]}.csv`;
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
