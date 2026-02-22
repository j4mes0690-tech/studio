'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Camera, Upload, X, Trash2, Plus, AlertTriangle, UserPlus, User } from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem, SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

const SnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type NewSnaggingListFormValues = z.infer<typeof SnaggingListSchema>;

export function NewSnaggingItem({ projects, subContractors }: { projects: Project[], subContractors: SubContractor[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingItemFileInputRef = useRef<HTMLInputElement>(null);

  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  // Item States
  const [items, setItems] = useState<Omit<SnaggingListItem, 'id'>[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false); 
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false); 
  const [itemPhotoTargetIdx, setItemPhotoTargetIdx] = useState<number | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

  const form = useForm<NewSnaggingListFormValues>({
    resolver: zodResolver(SnaggingListSchema),
    defaultValues: { projectId: '', areaId: '', title: '', description: '' },
  });

  const selectedProjectId = form.watch('projectId');
  const selectedAreaId = form.watch('areaId');

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', '');
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects, form]);

  useEffect(() => {
    if (selectedAreaId && selectedAreaId !== 'none') {
      const area = availableAreas.find(a => a.id === selectedAreaId);
      if (area) {
        form.setValue('title', `${area.name} Completion Snags`);
      }
    }
  }, [selectedAreaId, availableAreas, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };

    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetIdx !== null) {
      getCameraPermission();
    }

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetIdx]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return null;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 800; 
      canvas.height = 800 / aspectRatio;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw Timestamp Overlay
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString();
      const fullStr = `${dateStr} ${timeStr}`;
      
      context.font = 'bold 24px sans-serif';
      context.fillStyle = 'white';
      context.shadowColor = 'black';
      context.shadowBlur = 6;
      context.lineWidth = 2;
      
      const metrics = context.measureText(fullStr);
      const textWidth = metrics.width;
      const padding = 20;
      
      context.fillText(fullStr, canvas.width - textWidth - padding, canvas.height - padding);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return { url: dataUrl, takenAt: now.toISOString() };
    }
    return null;
  };

  const takeGeneralPhoto = () => {
    const photo = capturePhoto();
    if (photo) {
      setPhotos(prev => [...prev, photo]);
      setIsCameraOpen(false);
    }
  };

  const takeItemPhoto = () => {
    const photo = capturePhoto();
    if (photo) {
      if (itemPhotoTargetIdx !== null) {
        setItems(prev => prev.map((item, i) => {
          if (i === itemPhotoTargetIdx) {
            return { ...item, photos: [...(item.photos || []), photo] };
          }
          return item;
        }));
        setItemPhotoTargetIdx(null);
      } else {
        setPendingItemPhotos(prev => [...prev, photo]);
        setIsItemCameraOpen(false);
      }
    }
  };

  const handleAddItem = () => {
    if (newItemText.trim() || pendingItemPhotos.length > 0) {
      setItems([...items, { 
        description: newItemText.trim() || 'No description', 
        status: 'open', 
        photos: pendingItemPhotos,
        subContractorId: pendingSubId
      }]);
      setNewItemText('');
      setPendingItemPhotos([]);
      setPendingSubId(undefined);
      setIsItemCameraOpen(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const removeItemPhoto = (itemIdx: number, photoIdx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i === itemIdx) {
        return {
          ...item,
          photos: (item.photos || []).filter((_, pIdx) => pIdx !== photoIdx)
        };
      }
      return item;
    }));
  };

  const onSubmit = (values: NewSnaggingListFormValues) => {
    if (items.length === 0) {
      toast({ title: 'Item Required', description: 'Please add at least one snagging item to the list.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      const data = {
        ...values,
        createdAt: new Date().toISOString(),
        photos: photos,
        items: items.map((item, idx) => ({
          ...item,
          id: `item-${Date.now()}-${idx}`
        })),
      };
      
      const colRef = collection(db, 'snagging-items');
      addDoc(colRef, data)
        .then(() => {
          toast({ title: 'Success', description: 'Snagging list recorded.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setItems([]);
      setNewItemText('');
      setPendingItemPhotos([]);
      setPendingSubId(undefined);
      setIsCameraOpen(false);
      setIsItemCameraOpen(false);
      setItemPhotoTargetIdx(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="mr-2 h-4 w-4" />New List</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Record New Snagging List</DialogTitle>
          <DialogDescription>Create a list of defects to be addressed in a specific project area.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="areaId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Area (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId || availableAreas.length === 0}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select an area" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {availableAreas.length > 0 ? availableAreas.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        )) : <SelectItem value="none" disabled>No areas defined</SelectItem>}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>List Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Level 3 West Wing Completion Snags" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <FormLabel className="text-base font-semibold">Defect Items</FormLabel>
                    <VoiceInput 
                        onResult={(text) => {
                            setNewItemText(text);
                        }} 
                    />
                </div>
                
                <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Input 
                            placeholder="Describe a defect..." 
                            value={newItemText} 
                            onChange={(e) => setNewItemText(e.target.value)} 
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                        />
                      </div>
                      
                      <div className="flex gap-1 flex-shrink-0">
                        <Select value={pendingSubId || 'unassigned'} onValueChange={(val) => setPendingSubId(val === 'unassigned' ? undefined : val)}>
                          <SelectTrigger className="w-10 px-0 flex justify-center hover:bg-accent" title="Assign subcontractor">
                            <UserPlus className="h-4 w-4" />
                          </SelectTrigger>
                          <SelectContent className="min-w-[200px]">
                            <SelectItem value="unassigned" className="cursor-pointer hover:bg-accent focus:bg-accent">Unassigned</SelectItem>
                            {subContractors.map(sub => (
                              <SelectItem key={sub.id} value={sub.id} className="cursor-pointer hover:bg-accent focus:bg-accent">{sub.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button 
                          type="button" 
                          variant={isItemCameraOpen ? "secondary" : "outline"}
                          size="icon" 
                          onClick={() => {
                            setIsItemCameraOpen(!isItemCameraOpen);
                            setIsCameraOpen(false);
                            setItemPhotoTargetIdx(null);
                          }}
                          title="Take photo for this item"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" onClick={handleAddItem} title="Add item to list">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>

                  {(isItemCameraOpen || itemPhotoTargetIdx !== null) && (
                    <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                      {hasCameraPermission === false && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Camera Denied</AlertTitle>
                          <AlertDescription>Please allow camera access in your browser.</AlertDescription>
                        </Alert>
                      )}
                      <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={takeItemPhoto}>Capture Photo</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setIsItemCameraOpen(false); setItemPhotoTargetIdx(null); }}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {pendingSubId && (
                    <Badge variant="secondary" className="gap-1">
                      <User className="h-3 w-3" />
                      Assigned: {subContractors.find(s => s.id === pendingSubId)?.name}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setPendingSubId(undefined)} />
                    </Badge>
                  )}

                  {pendingItemPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-md border border-dashed">
                      {pendingItemPhotos.map((p, pIdx) => (
                        <div key={pIdx} className="relative w-12 h-12">
                          <Image src={p.url} alt="Pending item photo" fill className="rounded object-cover border" />
                          <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => setPendingItemPhotos(prev => prev.filter((_, idx) => idx !== pIdx))}>
                            <X className="h-2 w-2" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                    {items.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">No items added yet. Enter a description above.</p>
                    ) : (
                        items.map((item, idx) => {
                            const sub = subContractors.find(s => s.id === item.subContractorId);
                            return (
                                <div key={idx} className="space-y-2 bg-background p-3 rounded-md border shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium">{item.description}</span>
                                            {sub && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-2.5 w-2.5" /> {sub.name}</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                              type="button" 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 text-primary" 
                                              onClick={() => {
                                                setItemPhotoTargetIdx(idx);
                                                setIsCameraOpen(false);
                                                setIsItemCameraOpen(false);
                                              }}
                                            >
                                                <Camera className="h-4 w-4" />
                                            </Button>
                                            
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Remove Item?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    Are you sure you want to remove "{item.description}" from this list?
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => handleRemoveItem(idx)} className="bg-destructive hover:bg-destructive/90">
                                                    Remove
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>

                                    {item.photos && item.photos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {item.photos.map((p, pIdx) => (
                                                <div key={pIdx} className="relative w-12 h-12">
                                                    <Image src={p.url} alt="Item photo" fill className="rounded object-cover border" />
                                                    <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => removeItemPhoto(idx, pIdx)}>
                                                        <X className="h-2 w-2" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <FormLabel>General Reference Photos (Overall Area)</FormLabel>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <Image src={p.url} alt="Snag" fill className="rounded-md object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  className="w-20 h-20" 
                  onClick={() => {
                    setIsCameraOpen(true);
                    setIsItemCameraOpen(false);
                    setItemPhotoTargetIdx(null);
                  }}
                >
                  <Camera className="h-6 w-6" />
                </Button>
              </div>

              {isCameraOpen && (
                <div className="space-y-2 border rounded-md p-2 bg-muted/30 mt-2">
                  <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                  <div className="flex gap-2">
                    <Button type="button" onClick={takeGeneralPhoto}>Capture General Photo</Button>
                    <Button type="button" variant="ghost" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    <Button type="button" variant="outline" className="ml-auto" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              Array.from(files).forEach(f => {
                const reader = new FileReader();
                reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                reader.readAsDataURL(f);
              });
            }} />
            <input type="file" ref={pendingItemFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
              const files = e.target.files;
              if (!files) return;
              Array.from(files).forEach(f => {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const newPhoto = { url: re.target?.result as string, takenAt: new Date().toISOString() };
                    setPendingItemPhotos(prev => [...prev, newPhoto]);
                };
                reader.readAsDataURL(f);
              });
            }} />
          </form>
        </Form>

        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>{isPending ? 'Saving...' : 'Save Snagging List'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
