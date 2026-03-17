'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Save, FileText, Upload, X, ShieldCheck } from 'lucide-react';
import type { Project, DistributionUser, DrawingDocument, FileAttachment } from '@/lib/types';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NewDrawingSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Drawing title is required.'),
  reference: z.string().min(1, 'Drawing reference is required.'),
  revision: z.string().min(1, 'Revision is required.').max(5),
  status: z.enum(['active', 'superseded', 'draft']).default('active'),
});

type NewDrawingFormValues = z.infer<typeof NewDrawingSchema>;

export function NewDrawingDialog({ projects, currentUser }: { projects: Project[], currentUser: DistributionUser }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);

  const form = useForm<NewDrawingFormValues>({
    resolver: zodResolver(NewDrawingSchema),
    defaultValues: {
      projectId: '',
      title: '',
      reference: '',
      revision: '01',
      status: 'active',
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        url: event.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (values: NewDrawingFormValues) => {
    if (!selectedFile) {
        toast({ title: 'File Missing', description: 'Please select a drawing file to upload.', variant: 'destructive' });
        return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Uploading', description: 'Persisting drawing to secure storage...' });

        const blob = await dataUriToBlob(selectedFile.url);
        const fileName = `${values.projectId}/${values.reference}_Rev${values.revision}_${selectedFile.name}`;
        const url = await uploadFile(storage, `drawings/${fileName}`, blob);

        const drawingData: Omit<DrawingDocument, 'id'> = {
          projectId: values.projectId,
          title: values.title,
          reference: values.reference,
          revision: values.revision,
          status: values.status,
          file: {
            ...selectedFile,
            url
          },
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim(),
          sharepointUrl: null,
          lastSyncedAt: null
        };

        await addDoc(collection(db, 'drawings'), drawingData);
        toast({ title: 'Success', description: 'Drawing added to register.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to upload document.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Add Drawing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <FileText className="h-5 w-5" />
            </div>
            <DialogTitle>Register Project Drawing</DialogTitle>
          </div>
          <DialogDescription>Upload a technical document and assign it to the project register.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                        <SelectContent>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem><FormLabel>Drawing Reference</FormLabel><FormControl><Input placeholder="e.g. 104-ARCH-001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="revision" render={({ field }) => (
                    <FormItem><FormLabel>Revision</FormLabel><FormControl><Input placeholder="e.g. P01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Drawing Title</FormLabel><FormControl><Input placeholder="e.g. Typical Wall Sections" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-4">
                <Label>Document File</Label>
                <div className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 transition-colors text-center",
                    selectedFile ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/30"
                )}>
                    {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="bg-primary/10 p-3 rounded-full"><FileText className="h-8 w-8 text-primary" /></div>
                            <p className="text-sm font-bold truncate max-w-full">{selectedFile.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 gap-1" onClick={() => setSelectedFile(null)}><X className="h-3 w-3" /> Remove</Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-10 w-10 text-muted-foreground/30 mb-2" />
                            <p className="text-sm font-medium">Click to select or drag PDF/CAD file</p>
                            <p className="text-xs text-muted-foreground">Standard drawings, specifications, or schedules</p>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.dwg,.dxf,.zip,.doc,.docx" />
                </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border-2 border-primary/10 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Once recorded, this document will be automatically queued for backup to the corporate <strong>SharePoint</strong> environment.
                </p>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Add to Register
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
