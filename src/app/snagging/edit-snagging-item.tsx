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
import { Pencil, Camera, Upload, X, Trash2, CheckCircle2, Circle } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area, SnaggingListItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

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
};

export function EditSnaggingItem({ item, projects }: EditSnaggingItemProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemFileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);
  
  const [items, setItems] = useState<SnaggingListItem[]>(item.items || []);
  const [newItemText, setNewItemText] = useState('');
  const [itemPhotoTargetId, setItemPhotoTargetId] = useState<string | null>(null);

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
    }
  }, [open, item, form]);

  const handleAddItem = () => {
    if (newItemText.trim()) {
      setItems([...items, { id: `item-${Date.now()}`, description: newItemText.trim(), status: 'open', photos: [] }]);
      setNewItemText('');
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleItemStatus = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: i.status === 'open' ? 'closed' : 'open' } : i));
  };

  const handleAddItemPhoto = (itemId: string) => {
    setItemPhotoTargetId(itemId);
    itemFileInputRef.current?.click();
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
                <div className="flex gap-2">
                    <Input 
                        placeholder="Add another defect..." 
                        value={newItemText} 
                        onChange={(e) => setNewItemText(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }}}
                    />
                    <Button type="button" onClick={handleAddItem}>Add</Button>
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                    {items.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">No items in the list.</p>
                    ) : (
                        items.map((item) => (
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
                                    <span className={cn("text-sm flex-1", item.status === 'closed' && "line-through text-muted-foreground")}>
                                        {item.description}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleAddItemPhoto(item.id)}>
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
                        ))
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

        {/* Hidden file input for item photos */}
        <input 
            type="file" 
            ref={itemFileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => {
                const files = e.target.files;
                if (!files || !itemPhotoTargetId) return;
                
                Array.from(files).forEach(f => {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const newPhoto = { url: re.target?.result as string, takenAt: new Date().toISOString() };
                        setItems(prev => prev.map(i => {
                            if (i.id === itemPhotoTargetId) {
                                return { ...i, photos: [...(i.photos || []), newPhoto] };
                            }
                            return i;
                        }));
                    };
                    reader.readAsDataURL(f);
                });
                setItemPhotoTargetId(null);
            }} 
        />

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
