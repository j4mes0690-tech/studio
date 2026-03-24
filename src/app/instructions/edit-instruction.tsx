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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Camera, Upload, X, Loader2, Link as LinkIcon, FileText, FileIcon, HardHat, Ruler, Save } from 'lucide-react';
import type { Project, Photo, FileAttachment, Instruction, ClientInstruction, SubContractor } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, query, collection, where } from 'firebase/firestore';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';
import { Badge } from '@/components/ui/badge';
import { scrollToFirstError } from '@/lib/utils';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

const EditInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  clientInstructionId: z.string().optional().nullable(),
  originalText: z.string().min(10, 'Site instructions must be at least 10 characters.'),
  recipientEmail: z.string().min(1, 'Please assign this instruction to a partner.'),
});

type EditInstructionFormValues = z.infer<typeof EditInstructionSchema>;

export function EditInstruction({ 
  item, 
  projects, 
  subContractors,
  open,
  onOpenChange
}: { 
  item: Instruction; 
  projects: Project[]; 
  subContractors: SubContractor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>(item.photos || []);
  const [files, setFiles] = useState<FileAttachment[]>(item.files || []);

  const form = useForm<EditInstructionFormValues>({
    resolver: zodResolver(EditInstructionSchema),
    defaultValues: {
      projectId: item.projectId,
      clientInstructionId: item.clientInstructionId || 'none',
      originalText: item.originalText,
      recipientEmail: item.recipients?.[0] || '',
    },
  });

  useEffect(() => {
    if (open && item) {
      form.reset({
        projectId: item.projectId,
        clientInstructionId: item.clientInstructionId || 'none',
        originalText: item.originalText,
        recipientEmail: item.recipients?.[0] || '',
      });
      setPhotos(item.photos || []);
      setFiles(item.files || []);
    }
  }, [open, item, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const projectPartners = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    const assignedIds = selectedProject.assignedSubContractors || [];
    return (subContractors || []).filter(sub => 
      assignedIds.includes(sub.id) && (sub.isSubContractor || sub.isDesigner)
    );
  }, [selectedProjectId, selectedProject, subContractors]);

  const ciQuery = useMemoFirebase(() => {
    if (!db || !selectedProjectId) return null;
    return query(collection(db, 'client-instructions'), where('projectId', '==', selectedProjectId));
  }, [db, selectedProjectId]);
  const { data: clientDirectives } = useCollection<ClientInstruction>(ciQuery);

  const onCapture = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    
    Array.from(selectedFiles).forEach(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast({ 
          title: 'File Too Large', 
          description: `${f.name} exceeds the 20MB limit.`, 
          variant: 'destructive' 
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (re) => {
        setFiles(prev => [...prev, {
          name: f.name,
          type: f.type,
          size: f.size,
          url: re.target?.result as string
        }]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = '';
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

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `instructions/files/${item.id}-${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const updates = {
          projectId: values.projectId,
          clientInstructionId: values.clientInstructionId === 'none' ? null : values.clientInstructionId,
          originalText: values.originalText,
          summary: values.originalText.length > 100 ? values.originalText.substring(0, 100) + '...' : values.originalText,
          recipients: [values.recipientEmail],
          photos: uploadedPhotos,
          files: uploadedFiles,
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
          className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/5">
            <DialogTitle>Edit Site Instruction</DialogTitle>
            <DialogDescription>Modify instruction details or assigned recipients.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, () => scrollToFirstError())} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(v) => { field.onChange(v); form.setValue('recipientEmail', ''); }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="clientInstructionId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><LinkIcon className="h-3.5 w-3.5 text-primary" /> Linked Directive</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedProjectId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="No link" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Link</SelectItem>
                          {clientDirectives?.map(ci => <SelectItem key={ci.id} value={ci.id}>{ci.reference} - {ci.summary}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <FormField
                  control={form.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Partner</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subcontractor or designer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="flex items-center gap-2 text-primary">
                              <HardHat className="h-3 w-3" /> Sub-contractors
                            </SelectLabel>
                            {projectPartners.filter(p => p.isSubContractor).map(p => (
                              <SelectItem key={p.id} value={p.email}>{p.name}</SelectItem>
                            ))}
                          </SelectGroup>
                          <Separator className="my-1" />
                          <SelectGroup>
                            <SelectLabel className="flex items-center gap-2 text-accent">
                              <Ruler className="h-3 w-3" /> Designers
                            </SelectLabel>
                            {projectPartners.filter(p => p.isDesigner).map(p => (
                              <SelectItem key={p.id} value={p.email}>{p.name}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField control={form.control} name="originalText" render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Instruction Text</FormLabel>
                      <VoiceInput onResult={field.onChange} />
                    </div>
                    <FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl>
                  </FormItem>
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
                    <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed rounded-lg" onClick={() => setIsCameraOpen(true)}><Camera className="h-5 w-5" /><span className="text-[8px] font-black uppercase">Camera</span></Button>
                    <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed rounded-lg" onClick={() => fileInputRef.current?.click()}><Upload className="h-5 w-5" /><span className="text-[8px] font-black uppercase">Photos</span></Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <FormLabel>Technical Files (Max 20MB)</FormLabel>
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-md border bg-muted/30 group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-xs truncate font-medium">{f.name}</span>
                          <Badge variant="outline" className="text-[8px] h-4">{(f.size / 1024 / 1024).toFixed(1)}MB</Badge>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full h-10 border-dashed" onClick={() => docInputRef.current?.click()}>
                      <FileIcon className="mr-2 h-4 w-4" />
                      Attach Files
                    </Button>
                  </div>
                </div>

                <div className="pt-6 pb-10">
                  <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
            const selected = e.target.files; if (!selected) return;
            Array.from(selected).forEach(f => {
              const reader = new FileReader();
              reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
              reader.readAsDataURL(f);
            });
          }} />
          <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.dwg,.dxf" />
        </DialogContent>
      </Dialog>
      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={onCapture} 
        title="Site Instruction capture"
      />
    </>
  );
}
