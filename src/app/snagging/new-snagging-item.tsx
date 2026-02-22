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
import { PlusCircle, Camera, Upload, X } from 'lucide-react';
import type { Project, Photo, Area } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const SnaggingItemSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  areaId: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
});

type NewSnaggingItemFormValues = z.infer<typeof SnaggingItemSchema>;

export function NewSnaggingItem({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableAreas, setAreas] = useState<Area[]>([]);

  const form = useForm<NewSnaggingItemFormValues>({
    resolver: zodResolver(SnaggingItemSchema),
    defaultValues: { projectId: '', areaId: '', description: '' },
  });

  const selectedProjectId = form.watch('projectId');

  useEffect(() => {
    if (selectedProjectId) {
      const selectedProject = projects.find(p => p.id === selectedProjectId);
      setAreas(selectedProject?.areas || []);
      form.setValue('areaId', ''); // Reset area when project changes
    } else {
      setAreas([]);
    }
  }, [selectedProjectId, projects, form]);

  const onSubmit = (values: NewSnaggingItemFormValues) => {
    startTransition(async () => {
      const data = {
        ...values,
        createdAt: new Date().toISOString(),
        photos: photos,
      };
      const colRef = collection(db, 'snagging-items');
      addDoc(colRef, data)
        .then(() => {
          toast({ title: 'Success', description: 'Snagging item recorded.' });
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
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><PlusCircle className="mr-2 h-4 w-4" />New Item</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record New Snagging Item</DialogTitle>
          <DialogDescription>Capture a snagging issue to be addressed.</DialogDescription>
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

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Scuff marks on the wall..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Photos</FormLabel>
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
            <DialogFooter>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : 'Save Item'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}