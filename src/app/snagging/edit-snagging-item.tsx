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
import { Pencil, Camera, Upload, X, Trash2, CheckCircle2, Circle, Plus, AlertTriangle, UserPlus, User, Check } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem, SubContractor } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const EditSnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type EditSnaggingListFormValues = z.infer<typeof EditSnaggingListSchema>;

type EditSnaggingItemProps = {
  item: SnaggingItem;
  projects: Project[];
  subContractors: SubContractor[];
};

export function EditSnaggingItem({ item, projects, subContractors }: EditSnaggingItemProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingItemFileInputRef = useRef<HTMLInputElement>(null);

  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  // Item States
  const [items, setItems] = useState<SnaggingListItem[]>(item.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [pendingSubId, setPendingSubId] = useState<string | undefined>(undefined);
  const [isSubPopoverOpen, setIsSubPopoverOpen] = useState(false);
  
  // Camera States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isItemCameraOpen, setIsItemCameraOpen] = useState(false);
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();

  const form = useForm<EditSnaggingListFormValues>({
    resolver: zodResolver(EditSnaggingListSchema),
    defaultValues: {
      projectId: item.projectId,
      areaId: item.areaId || '',
      title: item.title || '',
      description: item.description || '',
    },
  });

  const selectedProjectId = form.watch('projectId');

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (open) {
      form.reset({
        projectId: item.projectId,
        areaId: item.areaId || '',
        title: item.title || '',
        description: item.description || '',
      });
      setPhotos(item.photos || []);
      setItems(item.items || []);
      setPendingItemPhotos([]);
      setPendingSubId(undefined);
      setNewItemText('');
      setIsCameraOpen(false);
      setIsItemCameraOpen(false);
      setItemPhotoTargetId(null);
    }
  }, [open, item, form]);

  // Handle Camera Stream
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

    if (isCameraOpen || isItemCameraOpen || itemPhotoTargetId !== null) {
      getCameraPermission();
    }

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraOpen, isItemCameraOpen, itemPhotoTargetId]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      return { url: dataUrl, takenAt: new Date().toISOString() };
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
      if (itemPhotoTargetId) {
        setItems(prev => prev.map(i => {
          if (i.id === itemPhotoTargetId) {
            return { ...i, photos: [...(i.photos || []), photo] };
          }
          return i;
        }));
        setItemPhotoTargetId(null);
      } else {
        setPendingItemPhotos(prev => [...prev, photo]);
        setIsItemCameraOpen(false);
      }
    }
  };

  const handleAddItem = () => {
    if (newItemText.trim() || pendingItemPhotos.length > 0) {
      setItems([...items, { 
        id: `item-${Date.now()}`, 
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

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleItemStatus = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: i.status === 'open' ? 'closed' : 'open' } : i));
  };

  const removeItemPhoto = (itemId: string, photoIdx: number) => {
    setItems(prev => prev.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          photos: (i.photos || []).filter((_, idx) => idx !== photoIdx)
        };
      }
      return i;
    }));
  };

  const onSubmit = (values: EditSnaggingListFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'snagging-items', item.id);
      const updates = {
        ...values,
        items: items,
        photos: photos,
      };
      
      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Snagging list updated.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit List</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Snagging List</DialogTitle>
          <DialogDescription>
            Update project details and manage items in this snagging list.
          </DialogDescription>
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
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
                <FormLabel className="text-base font-semibold">Defect Items</FormLabel>
                
                <div className="space-y-2">
                  <div className="flex gap-2">
                      <Input 
                          placeholder="Add another defect..." 
                          value={newItemText} 
                          onChange={(e) => setNewItemText(e.target.value)} 
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                      />
                      
                      <Popover open={isSubPopoverOpen} onOpenChange={setIsSubPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant={pendingSubId ? "default" : "outline"} 
                            size="icon"
                            title="Assign subcontractor"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="end">
                          <ScrollArea className="h-64">
                            <div className="p-2 space-y-1">
                              <div 
                                className={cn(
                                  "flex items-center px-3 py-2 rounded-md cursor-pointer text-sm transition-colors",
                                  !pendingSubId ? "bg-secondary text-secondary-foreground font-semibold" : "hover:bg-accent"
                                )} 
                                onClick={() => {
                                  setPendingSubId(undefined);
                                  setIsSubPopoverOpen(false);
                                }}
                              >
                                None
                              </div>
                              {subContractors.map(sub => (
                                <div 
                                  key={sub.id} 
                                  className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-xs transition-colors",
                                    pendingSubId === sub.id 
                                      ? "bg-primary text-primary-foreground font-semibold" 
                                      : "hover:bg-accent"
                                  )}
                                  onClick={() => {
                                    setPendingSubId(sub.id);
                                    setIsSubPopoverOpen(false);
                                  }}
                                >
                                  <span className="truncate">{sub.name}</span>
                                  {pendingSubId === sub.id && <Check className="h-3 w-3 ml-2 flex-shrink-0" />}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>

                      <Button 
                        type="button" 
                        variant={isItemCameraOpen ? "secondary" : "outline"} 
                        size="icon" 
                        onClick={() => {
                          setIsItemCameraOpen(!isItemCameraOpen);
                          setIsCameraOpen(false);
                          setItemPhotoTargetId(null);
                        }}
                        title="Take photo for this item"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" onClick={handleAddItem} title="Add item to list">
                        <Plus className="h-4 w-4" />
                      </Button>
                  </div>

                  {(isItemCameraOpen || itemPhotoTargetId) && (
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setIsItemCameraOpen(false); setItemPhotoTargetId(null); }}>Cancel</Button>
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
                        <p className="text-sm text-center text-muted-foreground py-4">No items in the list.</p>
                    ) : (
                        items.map((item) => {
                            const sub = subContractors.find(s => s.id === item.subContractorId);
                            return (
                                <div key={item.id} className="bg-background p-3 rounded-md border shadow-sm group">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 flex-shrink-0"
                                            onClick={() => toggleItemStatus(item.id)}
                                        >
                                            {item.status === 'closed' ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <Circle className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </Button>
                                        <div className="flex flex-col flex-1">
                                            <span className={cn("text-sm", item.status === 'closed' && "line-through text-muted-foreground")}>
                                                {item.description}
                                            </span>
                                            {sub && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-2.5 w-2.5" /> {sub.name}</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button 
                                              type="button" 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 text-primary" 
                                              onClick={() => {
                                                setItemPhotoTargetId(item.id);
                                                setIsCameraOpen(false);
                                                setIsItemCameraOpen(false);
                                              }}
                                            >
                                                <Camera className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveItem(item.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {item.photos && item.photos.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pl-10">
                                            {item.photos.map((p, pIdx) => (
                                                <div key={pIdx} className="relative w-12 h-12">
                                                    <Image src={p.url} alt="Item photo" fill className="rounded object-cover border" />
                                                    <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => removeItemPhoto(item.id, pIdx)}>
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

            <div className="space-y-4">
              <FormLabel>General Reference Photos</FormLabel>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <Image src={p.url} alt="Defect" fill className="rounded-md object-cover" />
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
                    setItemPhotoTargetId(null);
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
          <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
