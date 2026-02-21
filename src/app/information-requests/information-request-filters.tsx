
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

type InformationRequestFiltersProps = {
  projects: Project[];
};

export function InformationRequestFilters({ projects }: InformationRequestFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: 'project', value: string) => {
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

  const hasFilters = searchParams.has('project');
  
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
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
    </div>
  );
}
