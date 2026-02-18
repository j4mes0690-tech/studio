
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
import type { Client, Project } from '@/lib/types';

type InformationRequestFiltersProps = {
  clients: Client[];
  projects: Project[];
};

export function InformationRequestFilters({ clients, projects }: InformationRequestFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: 'client' | 'project', value: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    
    if (!value || value === "all") {
      current.delete(key);
      if (key === 'client') {
          current.delete('project');
      }
    } else {
      current.set(key, value);
      if (key === 'client') {
          current.delete('project');
      }
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';

    router.push(`${pathname}${query}`);
  };

  const selectedClient = searchParams.get('client') || 'all';
  const selectedProject = searchParams.get('project') || 'all';
  const filteredProjects = selectedClient !== 'all' ? projects.filter(p => p.clientId === selectedClient) : [];

  const hasFilters = searchParams.has('client') || searchParams.has('project');
  
  const clearFilters = () => {
    router.push(pathname);
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex-1 w-full sm:w-auto">
        <Select
          value={selectedClient}
          onValueChange={(value) => handleFilterChange('client', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by client..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 w-full sm:w-auto">
        <Select
          value={selectedProject}
          onValueChange={(value) => handleFilterChange('project', value)}
          disabled={selectedClient === 'all'}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by project..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {filteredProjects.map((project) => (
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
