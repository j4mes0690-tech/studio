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
import { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';

type SnaggingFiltersProps = {
  projects: Project[];
};

export function SnaggingFilters({ projects }: SnaggingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: 'project' | 'area', value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    if (!value || value === "all") {
      current.delete(key);
      // Reset area if project changes to 'all'
      if (key === 'project') {
        current.delete('area');
      }
    } else {
      current.set(key, value);
      // Reset area if project changes to a new specific one
      if (key === 'project') {
        current.delete('area');
      }
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';

    router.push(`${pathname}${query}`);
  };

  const selectedProject = searchParams.get('project') || 'all';
  const selectedArea = searchParams.get('area') || 'all';

  const projectAreas = useMemo(() => {
    if (selectedProject === 'all') return [];
    return projects.find(p => p.id === selectedProject)?.areas || [];
  }, [projects, selectedProject]);

  const hasFilters = searchParams.has('project') || searchParams.has('area');
  
  const clearFilters = () => {
    router.push(pathname);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex-1 w-full sm:w-auto">
        <Select
          value={selectedProject}
          onValueChange={(value) => handleFilterChange('project', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by project..." />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 w-full sm:w-auto">
        <Select
          value={selectedArea}
          onValueChange={(value) => handleFilterChange('area', value)}
          disabled={selectedProject === 'all' || (projectAreas.length === 0 && selectedArea === 'all')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by area..." />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">All Areas</SelectItem>
            {projectAreas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
            {projectAreas.length > 0 && <Separator className="my-1" />}
            <SelectItem value="other">Other / Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
    </div>
  );
}
