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
import { PlusCircle, Camera, Upload, X, RefreshCw } from 'lucide-react';
import type { Project, DistributionUser, Photo } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { summarizeInstructions } from '@/ai/flows/summarize-client-instructions';
import { extractInstructionActionItems } from '@/ai/flows/extract-instruction-action-items';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { VoiceInput } from '@/components/voice-input';

const NewInstructionSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z
    .string()
    .min(10, 'Instructions must be at least 10 characters.'),
  photos: z.string().optional(),
  recipients: z.array(z.string()).optional(),
});

type NewInstructionFormValues = z.infer<typeof NewInstructionSchema>;

type NewInstructionProps = {
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function NewInstruction({ projects, distributionUsers }: NewInstructionProps) {
  const [open, setOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>();
  const { toast } = useToast();
  const db = useFirestore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);

  const form = useForm<NewInstructionFormValues>({
    resolver: zodResolver(NewInstructionSchema),
    defaultValues: {
      projectId: '',
      originalText: '',
      photos: '',
      recipients: [],
    },
  });

  useEffect(() => {
    form.setValue('photos', JSON.stringify(photos));
  }, [photos, form]);

  const onSubmit = (values: NewInstructionFormValues) => {
    startTransition(async () => {
      try {
        // Run AI flows
        const [summaryResult, actionItemsResult] = await Promise.all([
          summarizeInstructions({ instructions: values.originalText }),
          extractInstructionActionItems({ instructionText: values.originalText }),
        ]);

        const instructionData = {
          projectId: values.projectId,
          originalText: values.originalText,
          summary: summaryResult.summary,
          actionItems: actionItemsResult.actionItems,
          recipients: values.recipients || [],
          createdAt: new Date().toISOString(),
          photos: photos,
        };

        const colRef = collection(db, 'instructions');
        addDoc(colRef, instructionData)
          .then(() => {
            toast({ title: 'Success', description: 'Instruction recorded and processed.' });
            setOpen(false);
          })
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: colRef.path,
              operation: 'create',
              requestResourceData: instructionData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });

      } catch (err) {
        console.error(err);
        toast({ title: 'AI Processing Error', description: 'Failed to summarize instructions.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setIsCameraOpen(false);
      setPhotos([]);
      form.reset();
    }
  }, [open, form]);

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
    if (isCameraOpen) getCameraPermission();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraOpen, facingMode]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Instruction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record New Instruction</DialogTitle>
          <DialogDescription>
            Capture instructions on-site. The AI will summarize and extract action items automatically.
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
              name="originalText"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Instruction Text</FormLabel>
                    <VoiceInput 
                      onResult={(text) => {
                        form.setValue('originalText', text);
                      }} 
                    />
                  </div>
                  <FormControl>
                    <Textarea placeholder="Enter instructions here..." className="min-h-[150px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Photos</FormLabel>
              <div className="space-y-4">
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {photos.map((p, i) => (
                      <div key={i} className="relative group">
                        <Image src={p.url} alt="Site" width={200} height={150} className="rounded-md border object-cover aspect-video" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {isCameraOpen ? (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full aspect-video bg-muted rounded-md object-cover" autoPlay muted playsInline />
                    <div className="flex gap-2">
                      <Button type="button" onClick={takePhoto}>Take Photo</Button>
                      <Button type="button" variant="outline" size="icon" onClick={toggleCamera} title="Switch Camera">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Take Photo</Button>
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button>
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
                )}
              </div>
            </FormItem>

            <Separator />
            
            <FormItem>
              <FormLabel>Email Distribution</FormLabel>
              <ScrollArea className="h-40 rounded-md border p-4">
                {distributionUsers.map((u) => (
                  <FormField
                    key={u.id}
                    control={form.control}
                    name="recipients"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-3 space-y-0 mb-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(u.email)}
                            onCheckedChange={(c) => {
                              const curr = field.value || [];
                              field.onChange(c ? [...curr, u.email] : curr.filter(v => v !== u.email));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{u.name} ({u.email})</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </ScrollArea>
            </FormItem>

            <canvas ref={canvasRef} className="hidden" />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>{isPending ? 'Processing...' : 'Save Instruction'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
