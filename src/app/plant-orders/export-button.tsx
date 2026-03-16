'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { PlantOrder, Project } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ExportButtonProps = {
  orders: PlantOrder[];
  projects: Project[];
};

export function ExportButton({
  orders,
  projects,
}: ExportButtonProps) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const escapeCsvCell = (cell: string | number | null | undefined) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = () => {
    const headers = [
      'Ref',
      'CVR Code',
      'Project',
      'Supplier',
      'Description',
      'Status',
      'Total Amount',
      'Created At'
    ];

    const rows = orders.map((order) => {
      const project = projectMap.get(order.projectId);
      return [
        order.reference,
        order.cvrCode || '',
        project?.name || 'N/A',
        order.supplierName,
        order.description,
        order.status,
        order.totalAmount.toFixed(2),
        new Date(order.createdAt).toLocaleString(),
      ].map(escapeCsvCell);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `plant-orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleExport} className="h-9 w-9">
            <Download className="h-5 w-5" />
            <span className="sr-only">Export CSV</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export Internal CSV (Includes CVR)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
