'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
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
import { Pencil, Camera, Upload, X, Loader2, Link as LinkIcon } from 'lucide-react';
import type { Project, Photo, FileAttachment, Instruction, ClientInstruction } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, query, collection, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';

const EditInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  clientInstructionId: z.string().optional().nullable(),
  originalText: z.string().min(10, 'Site instructions must be at least 10 characters.'),
});

type EditInstructionFormValues = z.infer<typeof EditInstructionSchema>;

export function EditInstruction({ 
  item, 
  projects, 
  open,
  onOpenChange
}: { 
  item: Instruction; 
  projects: Project[]; 
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);

  const form = useForm<EditInstructionFormValues>({
    resolver: zodResolver(EditInstructionSchema),
    defaultValues: {
      projectId: item.projectId,
      clientInstructionId: item.clientInstructionId || 'none',
      originalText: item.originalText,
    },
  });

  useEffect(() => {
    if (open && item) {
      form.reset({
        projectId: item.projectId,
        clientInstructionId: item.clientInstructionId || 'none',
        originalText: item.originalText,
      });
      setPhotos(item.photos || []);
    }
  }, [open, item, form]);

  const selectedProjectId = form.watch('projectId');

  const ciQuery = useMemoFirebase(() => {
    if (!db || !selectedProjectId) return null;
    return query(collection(db, 'client-instructions'), where('projectId', '==', selectedProjectId));
  }, [db, selectedProjectId]);
  const { data: clientDirectives } = useCollection<ClientInstruction>(ciQuery);

  const onCapture = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  };

  const onSubmit = (values: EditInstructionFormValues) => {
    startTransition(async () => {
      try {
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `instructions/photos/${item.id}-${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const updates = {
          projectId: values.projectId,
          clientInstructionId: values.clientInstructionId === 'none' ? null : values.clientInstructionId,
          originalText: values.originalText,
          summary: values.originalText.length > 100 ? values.originalText.substring(0, 100) + '...' : values.originalText,
          photos: uploadedPhotos,
        };

        await updateDoc(doc(db, 'instructions', item.id), updates);
        toast({ title: 'Success', description: 'Instruction updated.' });
        onOpenChange(false);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update instruction.', variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle>Edit Site Instruction</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Project</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></FormItem>
                )} />
                <FormField control={form.control} name="clientInstructionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5 text-primary" /> Linked Directive</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Link</SelectItem>
                        {clientDirectives?.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.reference} - {ci.summary}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="originalText" render={({ field }) => (
                <FormItem><div className="flex justify-between items-center"><FormLabel>Instruction Text</FormLabel><VoiceInput onResult={field.onChange} /></div><FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl></FormItem>
              )} />
              <div className="space-y-4">
                <FormLabel>Visual Evidence</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 group">
                      <Image src={p.url} alt="Site" fill className="rounded-md object-cover border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Camera</Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <CameraOverlay isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={onCapture} />
    </>
  );
}
