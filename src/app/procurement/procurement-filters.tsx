'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';
import { Filter, X } from 'lucide-react';

type ProcurementFiltersProps = {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
};

export function ProcurementFilters({ 
  projects, 
  selectedProjectId, 
  onProjectChange,
  selectedStatus,
  onStatusChange
}: ProcurementFiltersProps) {
  const hasFilters = selectedProjectId !== 'all' || selectedStatus !== 'all';
  
  const clearFilters = () => {
    onProjectChange('all');
    onStatusChange('all');
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] shrink-0 px-3">
        <Filter className="h-4 w-4" />
        Filter Log:
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full flex-1">
        <Select value={selectedProjectId} onValueChange={onProjectChange}>
          <SelectTrigger className="bg-background h-11 text-sm rounded-lg border-muted">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Authorized Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="bg-background h-11 text-sm rounded-lg border-muted">
            <SelectValue placeholder="Any Process Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Status</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="enquiry">Enquiry Issued</SelectItem>
            <SelectItem value="tender-returned">Tender Returned</SelectItem>
            <SelectItem value="ordered">Order Placed</SelectItem>
            <SelectItem value="on-site">Start on Site</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilters} 
          className="h-11 px-4 text-xs font-bold gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
