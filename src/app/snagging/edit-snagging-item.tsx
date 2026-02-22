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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Camera, Upload, X } from 'lucide-react';
import type { Project, SnaggingItem, Photo, Area } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const EditSnaggingItemSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
});

type EditSnaggingItemFormValues = z.infer<typeof EditSnaggingItemSchema>;

type EditSnaggingItemProps = {
  item: SnaggingItem;
  projects: Project[];
};

export function EditSnaggingItem({ item, projects }: EditSnaggingItemProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [availableAreas, setAreas] = useState<Area[]>([]);

  const form = useForm<EditSnaggingItemFormValues>({
    resolver: zodResolver(EditSnaggingItemSchema),
    defaultValues: {
      projectId: item.projectId,
      areaId: item.areaId || '',
      description: item.description,
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
        description: item.description,
      });
      setPhotos(item.photos || []);
    }
  }, [open, item, form]);

  const onSubmit = (values: EditSnaggingItemFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'snagging-items', item.id);
      const updates = {
        projectId: values.projectId,
        areaId: values.areaId || null,
        description: values.description,
        photos: photos,
      };
      
      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Item updated.' });
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
            <span className="sr-only">Edit Item</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Snagging Item</DialogTitle>
          <DialogDescription>
            Update the details for this snagging item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the issue..." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Photos</FormLabel>
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
            
            <DialogFooter>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}