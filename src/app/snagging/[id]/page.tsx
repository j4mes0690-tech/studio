'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState, useEffect, useRef, useTransition, Suspense } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useCollection, useUser, useStorage } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { SnaggingItem, Project, SubContractor, SnaggingListItem, Photo, Area, DistributionUser } from '@/lib/types';
import { ChevronLeft, Camera, Upload, X, Trash2, CheckCircle2, Circle, Plus, UserPlus, User, Loader2, Save, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { VoiceInput } from '@/components/voice-input';

function EditSnaggingContent() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const { user: sessionUser } = useUser();
  const [isPending, startTransition] = useTransition();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Data
  const snagRef = useMemo(() => (db && id ? doc(db, 'snagging-items', id) : null), [db, id]);
  const { data: item, isLoading: itemLoading } = useDoc<SnaggingItem>(snagRef);

  const projectsQuery = useMemo(() => (db ? collection(db, 'projects') : null), [db]);
  const { data: allProjects, isLoading: projectsLoading } = useCollection<Project>(projectsQuery);

  const subsQuery = useMemo(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: subContractors, isLoading: subsLoading } = useCollection<SubContractor>(subsQuery);

  const profileRef = useMemo(() => (db && sessionUser?.email ? doc(db, 'users', sessionUser.email.toLowerCase().trim()) : null), [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [items, setItems] = useState<SnaggingListItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  // Local UI State
  const [newItemText, setNewItemText] = useState('');
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

  // Sync initial data
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setProjectId(item.projectId || '');
      setAreaId(item.areaId || '');
      setItems(item.items || []);
      setPhotos(item.photos || []);
    }
  }, [item]);

  // Derived
  const selectedProject = useMemo(() => allProjects?.find(p => p.id === projectId), [allProjects, projectId]);
  const availableAreas = selectedProject?.areas || [];

  const allowedProjects = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects;
    const email = profile.email.toLowerCase().trim();
    return allProjects.filter(p => (p.assignedUsers || []).some(u => u.toLowerCase().trim() === email));
  }, [allProjects, profile]);

  const isAuthorized = useMemo(() => {
    if (!profile || !item) return false;
    if (profile.permissions?.hasFullVisibility) return true;
    return allowedProjects.some(p => p.id === item.projectId);
  }, [profile, item, allowedProjects]);

  // Camera handling
  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (isCameraOpen || itemPhotoTargetId) getCameraPermission();
    return () => { 
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isCameraOpen, itemPhotoTargetId, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = new Date();
      const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      context.font = 'bold 24px sans-serif';
      context.fillStyle = 'white';
      context.shadowColor = 'black';
      context.shadowBlur = 6;
      context.fillText(timestamp, canvas.width - context.measureText(timestamp).width - 20, canvas.height - 20);
      return { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: now.toISOString() };
    }
    return null;
  };

  const takeGeneralPhoto = () => {
    const p = capturePhoto();
    if (p) {
      setPhotos(prev => [...prev, p]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = () => {
    const p = capturePhoto();
    if (p && itemPhotoTargetId) {
      setItems(prev => prev.map(i => {
        if (i.id === itemPhotoTargetId) {
          const field = i.status === 'closed' ? 'photos' : 'completionPhotos';
          return { ...i, [field]: [...(i[field] || []), p] };
        }
        return i;
      }));
      setItemPhotoTargetId(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleAddItem = () => {
    if (newItemText.trim()) {
      setItems([...items, { 
        id: `item-${Date.now()}`, 
        description: newItemText.trim(), 
        status: 'open', 
        photos: [],
        subContractorId: pendingSubId
      }]);
      setNewItemText('');
      setPendingSubId(undefined);
    }
  };

  const handleSave = () => {
    if (!snagRef) return;
    startTransition(async () => {
      try {
        toast({ title: 'Saving', description: 'Uploading media items...' });

        // 1. Upload overall list photos
        const uploadedGeneralPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `snagging/general/${id}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // 2. Upload individual item photos
        const uploadedItems = await Promise.all(
          items.map(async (item) => {
            const upPhotos = await Promise.all((item.photos || []).map(async (p, i) => {
              if (p.url.startsWith('data:')) {
                const blob = await dataUriToBlob(p.url);
                const url = await uploadFile(storage, `snagging/items/${id}-${item.id}-defect-${i}.jpg`, blob);
                return { ...p, url };
              }
              return p;
            }));

            const upCompletion = await Promise.all((item.completionPhotos || []).map(async (p, i) => {
              if (p.url.startsWith('data:')) {
                const blob = await dataUriToBlob(p.url);
                const url = await uploadFile(storage, `snagging/items/${id}-${item.id}-fixed-${i}.jpg`, blob);
                return { ...p, url };
              }
              return p;
            }));

            return { ...item, photos: upPhotos, completionPhotos: upCompletion };
          })
        );

        const updates = { 
          title, 
          description: description || null, 
          projectId, 
          areaId: areaId || null, 
          items: uploadedItems.map(i => ({
            ...i,
            subContractorId: i.subContractorId || null,
            photos: i.photos || [],
            completionPhotos: i.completionPhotos || []
          })), 
          photos: uploadedGeneralPhotos 
        };

        await updateDoc(snagRef, updates).catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: snagRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
          throw error;
        });

        toast({ title: 'Success', description: 'Snagging list saved.' });
        router.push('/snagging');

      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to upload media or save records.', variant: 'destructive' });
      }
    });
  };

  if (itemLoading || projectsLoading || subsLoading || profileLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item || !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-muted-foreground">You do not have permission to edit this record.</p>
        <Button onClick={() => router.push('/snagging')}>Return to Log</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>List Metadata</CardTitle>
          <CardDescription>Basic information about this snagging area.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {allowedProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Area</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                <SelectContent>
                  {availableAreas.length > 0 ? availableAreas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  )) : <SelectItem value="none" disabled>No areas defined</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>List Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Level 3 Snags" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defect Items</CardTitle>
          <CardDescription>The specific tasks that need to be addressed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Add New Defect</Label>
                <VoiceInput onResult={(text) => setNewItemText(text)} />
              </div>
              <Input 
                placeholder="Describe the issue..." 
                value={newItemText} 
                onChange={(e) => setNewItemText(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
              />
            </div>
            <div className="flex gap-1">
              <Select value={pendingSubId || 'unassigned'} onValueChange={val => setPendingSubId(val === 'unassigned' ? undefined : val)}>
                <SelectTrigger className="w-10 px-0 flex justify-center"><UserPlus className="h-4 w-4" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {subContractors?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" onClick={handleAddItem} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-4">
            {items.map((listItem) => {
              const sub = subContractors?.find(s => s.id === listItem.subContractorId);
              return (
                <div key={listItem.id} className="p-4 border rounded-lg bg-muted/10 space-y-3 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, status: i.status === 'open' ? 'closed' : 'open' } : i))}
                        className="mt-1"
                      >
                        {listItem.status === 'closed' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <div>
                        <p className={cn("font-medium", listItem.status === 'closed' && "line-through text-muted-foreground")}>{listItem.description}</p>
                        {sub && <Badge variant="secondary" className="mt-1 text-[10px] gap-1"><User className="h-2 w-2" /> {sub.name}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => setItemPhotoTargetId(listItem.id)} className="text-primary"><Camera className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setItems(items.filter(i => i.id !== listItem.id))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {(listItem.photos?.length || 0) > 0 && (
                    <div className="pl-8 flex flex-wrap gap-2">
                      {listItem.photos?.map((p, idx) => (
                        <div key={idx} className="relative w-16 h-16">
                          <Image src={p.url} alt="Defect" fill className="rounded object-cover border" />
                          <button onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, photos: i.photos?.filter((_, pi) => pi !== idx) } : i))} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"><X className="h-2 w-2" /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(listItem.completionPhotos?.length || 0) > 0 && (
                    <div className="pl-8 space-y-1">
                      <p className="text-[9px] font-bold text-green-600 uppercase">Completion Evidence</p>
                      <div className="flex flex-wrap gap-2">
                        {listItem.completionPhotos?.map((p, idx) => (
                          <div key={idx} className="relative w-16 h-16">
                            <Image src={p.url} alt="Fixed" fill className="rounded object-cover border border-green-200" />
                            <button onClick={() => setItems(items.map(i => i.id === listItem.id ? { ...i, completionPhotos: i.completionPhotos?.filter((_, pi) => pi !== idx) } : i))} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"><X className="h-2 w-2" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Photos</CardTitle>
          <CardDescription>General documentation photos for this area.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {photos.map((p, i) => (
              <div key={i} className="relative w-32 h-24">
                <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <Button variant="outline" className="w-32 h-24 flex flex-col gap-2 border-dashed" onClick={() => setIsCameraOpen(true)}>
              <Camera className="h-6 w-6" />
              <span className="text-xs">Take Photo</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Camera Overlays */}
      {(isCameraOpen || itemPhotoTargetId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-lg space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-white/10">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            </div>
            <div className="flex justify-center gap-4">
              <Button size="lg" onClick={isCameraOpen ? takeGeneralPhoto : takeItemPhoto} className="rounded-full h-16 w-16 p-0 border-4 border-white/20"><div className="h-10 w-10 rounded-full bg-white" /></Button>
              <Button variant="outline" size="icon" onClick={toggleCamera} className="rounded-full h-12 w-12 text-white border-white/40 hover:bg-white/20" title="Switch Camera">
                <RefreshCw className="h-6 w-6" />
              </Button>
              <Button variant="outline" onClick={() => { setIsCameraOpen(false); setItemPhotoTargetId(null); }} className="rounded-full h-12 px-6 border-white/40 text-white hover:bg-white/20">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default function SnaggingEditPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header title="Edit Snagging List" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <EditSnaggingContent />
        </Suspense>
      </main>
    </div>
  );
}
