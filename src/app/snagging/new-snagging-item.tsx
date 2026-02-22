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
import { PlusCircle, Camera, Upload, X, Trash2, Plus } from 'lucide-react';
import type { Project, Photo, Area, SnaggingListItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const SnaggingListSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  title: z.string().min(3, 'List title is required.'),
  description: z.string().optional(),
});

type NewSnaggingListFormValues = z.infer<typeof SnaggingListSchema>;

export function NewSnaggingItem({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemFileInputRef = useRef<HTMLInputElement>(null);
  const pendingItemFileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<Omit<SnaggingListItem, 'id'>[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [pendingItemPhotos, setPendingItemPhotos] = useState<Photo[]>([]);
  const [itemPhotoTargetIdx, setItemPhotoTargetIdx] = useState<number | null>(null);

  const form = useForm<NewSnaggingListFormValues>({
    resolver: zodResolver(SnaggingListSchema),
    defaultValues: { projectId: '', areaId: '', title: '', description: '' },
  });

  const selectedProjectId = form.watch('projectId');

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', '');
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects, form]);

  const handleAddItem = () => {
    if (newItemText.trim() || pendingItemPhotos.length > 0) {
      setItems([...items, { 
        description: newItemText.trim() || 'No description', 
        status: 'open', 
        photos: pendingItemPhotos 
      }]);
      setNewItemText('');
      setPendingItemPhotos([]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddItemPhoto = (index: number) => {
    setItemPhotoTargetIdx(index);
    itemFileInputRef.current?.click();
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
                
                <div className="space-y-2">
                  <div className="flex gap-2">
                      <Input 
                          placeholder="Describe a defect..." 
                          value={newItemText} 
                          onChange={(e) => setNewItemText(e.target.value)} 
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        onClick={() => pendingItemFileInputRef.current?.click()}
                        title="Attach photo to this item"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" onClick={handleAddItem} title="Add item to list">
                        <Plus className="h-4 w-4" />
                      </Button>
                  </div>
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
                        items.map((item, idx) => (
                            <div key={idx} className="space-y-2 bg-background p-3 rounded-md border shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{item.description}</span>
                                    <div className="flex items-center gap-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleAddItemPhoto(idx)}>
                                            <Camera className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(idx)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
                        ))
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
                <Button type="button" variant="outline" size="icon" className="w-20 h-20" onClick={() => fileInputRef.current?.click()}><Camera className="h-6 w-6" /></Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach(f => {
                    const reader = new FileReader();
                    reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                    reader.readAsDataURL(f);
                  });
                }} />
              </div>
            </div>
          </form>
        </Form>

        {/* Hidden file input for existing item photos */}
        <input 
            type="file" 
            ref={itemFileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => {
                const files = e.target.files;
                if (!files || itemPhotoTargetIdx === null) return;
                
                Array.from(files).forEach(f => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const newPhoto = { url: re.target?.result as string, takenAt: new Date().toISOString() };
                        setItems(prev => prev.map((item, i) => {
                            if (i === itemPhotoTargetIdx) {
                                return { ...item, photos: [...(item.photos || []), newPhoto] };
                            }
                            return item;
                        }));
                    };
                    reader.readAsDataURL(f);
                });
                setItemPhotoTargetIdx(null);
            }} 
        />

        {/* Hidden file input for new pending item photos */}
        <input 
            type="file" 
            ref={pendingItemFileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={(e) => {
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
            }} 
        />

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>{isPending ? 'Saving...' : 'Save Snagging List'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
