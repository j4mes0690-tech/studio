'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import type { SiteProgressPhoto, Project, DistributionUser, Photo } from '@/lib/types';
import { Loader2, Camera, ShieldCheck, Filter, Search, Grid2X2, LayoutGrid, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { AddPhotoDialog } from './add-photo-dialog';
import { PhotoCard } from './photo-card';
import { ImageLightbox } from '@/components/image-lightbox';
import { format, parseISO, isSameDay } from 'date-fns';

function SitePhotosContent() {
  const db = useFirestore();
  const { user: sessionUser } = useUser();
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Data Loading
  const profileRef = useMemoFirebase(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile } = useDoc<DistributionUser>(profileRef);

  const projectsQuery = useMemoFirebase(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const photosQuery = useMemoFirebase(() => (db ? query(collection(db, 'site-photos'), orderBy('createdAt', 'desc')) : null), [db]);
  const { data: allPhotos, isLoading: photosLoading } = useCollection<SiteProgressPhoto>(photosQuery);

  // Security & Filtering
  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const allowedProjectIds = useMemo(() => allowedProjects.map(p => p.id), [allowedProjects]);

  const projectAreas = useMemo(() => {
    if (projectFilter === 'all') return [];
    const p = allowedProjects.find(proj => proj.id === projectFilter);
    return p?.areas || [];
  }, [allowedProjects, projectFilter]);

  const filteredPhotos = useMemo(() => {
    if (!allPhotos) return [];
    return allPhotos.filter(p => {
      const isAuthorised = allowedProjectIds.includes(p.projectId);
      const matchesProject = projectFilter === 'all' || p.projectId === projectFilter;
      const matchesArea = areaFilter === 'all' || p.areaId === areaFilter;
      const matchesSearch = !searchTerm || (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      return isAuthorised && matchesProject && matchesArea && matchesSearch;
    });
  }, [allPhotos, allowedProjectIds, projectFilter, areaFilter, searchTerm]);

  // Grouping by Date for Timeline View
  const groupedPhotos = useMemo(() => {
    const groups: { date: string, photos: SiteProgressPhoto[] }[] = [];
    filteredPhotos.forEach(p => {
        const dateLabel = format(parseISO(p.createdAt), 'yyyy-MM-dd');
        const existingGroup = groups.find(g => g.date === dateLabel);
        if (existingGroup) {
            existingGroup.photos.push(p);
        } else {
            groups.push({ date: dateLabel, photos: [p] });
        }
    });
    return groups;
  }, [filteredPhotos]);

  if (photosLoading || !profile) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFullVisibility = !!profile?.permissions?.hasFullVisibility;

  return (
    <div className="flex flex-col w-full gap-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            Site Progress Gallery
          </h2>
          <p className="text-sm text-muted-foreground">High-resolution visual documentation of site evolution.</p>
          {hasFullVisibility && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-[0.2em] pt-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrative Oversight Active
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AddPhotoDialog 
            projects={allowedProjects} 
            currentUser={profile}
          />
        </div>
      </div>

      <Card className="bg-muted/30 border-none shadow-none">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Project</Label>
            <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setAreaFilter('all'); }}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Authorised Projects</SelectItem>
                {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Area / Plot</Label>
            <Select value={areaFilter} onValueChange={setAreaFilter} disabled={projectFilter === 'all'}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="All Areas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {projectAreas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Search Keywords</Label>
            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search descriptions..." 
                    className="pl-9 h-10 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-10 pb-24">
        {groupedPhotos.length > 0 ? (
          groupedPhotos.map(group => (
            <div key={group.date} className="space-y-4 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 sticky top-14 md:top-16 z-20 py-2 bg-background/95 backdrop-blur-md">
                    <Badge variant="secondary" className="h-8 px-4 gap-2 font-black uppercase text-[10px] tracking-widest bg-primary/10 text-primary border-primary/20">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(group.date), 'EEEE, do MMMM yyyy')}
                    </Badge>
                    <div className="h-px flex-1 bg-muted" />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {group.photos.map(p => (
                        <PhotoCard 
                            key={p.id} 
                            photoRecord={p} 
                            project={allProjects?.find(proj => proj.id === p.projectId)}
                            onView={() => setViewingPhoto(p.photo)}
                        />
                    ))}
                </div>
            </div>
          ))
        ) : (
          <div className="text-center py-24 border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground/40">
            <Camera className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">No progress photos found</p>
            <p className="text-sm">Capture your first site progress photo to start the visual audit trail.</p>
          </div>
        )}
      </div>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </div>
  );
}

export default function SitePhotosPage() {
  return (
    <div className="flex flex-col w-full min-h-svh bg-background">
      <Header title="Site Photos" />
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <SitePhotosContent />
      </Suspense>
    </div>
  );
}
