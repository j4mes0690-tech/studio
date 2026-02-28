
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

type PermitFiltersProps = {
  projects: Project[];
};

export function PermitFilters({ projects }: PermitFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    if (!value || value === "all") {
      current.delete(key);
    } else {
      current.set(key, value);
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';

    router.push(`${pathname}${query}`);
  };

  const selectedProject = searchParams.get('project') || 'all';
  const selectedType = searchParams.get('type') || 'all';
  const selectedStatus = searchParams.get('status') || 'all';

  const hasFilters = searchParams.has('project') || searchParams.has('type') || searchParams.has('status');
  
  const clearFilters = () => {
    router.push(pathname);
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] shrink-0 px-3">
        <Filter className="h-4 w-4" />
        Filter By:
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full flex-1">
        <Select
          value={selectedProject}
          onValueChange={(value) => handleFilterChange('project', value)}
        >
          <SelectTrigger className="bg-background h-11 text-sm rounded-lg border-muted">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedType}
          onValueChange={(value) => handleFilterChange('type', value)}
        >
          <SelectTrigger className="bg-background h-11 text-sm rounded-lg border-muted">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Hot Work">Hot Work</SelectItem>
            <SelectItem value="Confined Space">Confined Space</SelectItem>
            <SelectItem value="Excavation">Excavation</SelectItem>
            <SelectItem value="Lifting">Lifting Ops</SelectItem>
            <SelectItem value="General">General Works</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedStatus}
          onValueChange={(value) => handleFilterChange('status', value)}
        >
          <SelectTrigger className="bg-background h-11 text-sm rounded-lg border-muted">
            <SelectValue placeholder="Any Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Active/Issued</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-11 px-4 text-xs font-bold gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
          <X className="h-4 w-4" /> Clear
        </Button>
      )}
    </div>
  );
}
