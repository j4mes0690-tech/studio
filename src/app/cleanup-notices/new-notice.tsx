
'use client';

import { useState, useEffect, useRef, useActionState } from 'react';
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
import { createCleanUpNoticeAction, type FormState } from './actions';
import { PlusCircle, Camera, RefreshCw } from 'lucide-react';
import type { Client, Project, SubContractor } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

const NewNoticeSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
  recipients: z.array(z.string()).optional(),
});

type NewNoticeFormValues = z.infer<typeof NewNoticeSchema>;

type NewNoticeProps = {
  clients: Client[];
  projects: Project[];
  subContractors: SubContractor[];
};

export function NewNotice({ clients, projects, subContractors }: NewNoticeProps) {
  const [open, setOpen] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | undefined
  >();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<NewNoticeFormValues>({
    resolver: zodResolver(NewNoticeSchema),
    defaultValues: {
      clientId: '',
      projectId: '',
      description: '',
      photoUrl: '',
      photoTimestamp: '',
      recipients: [],
    },
  });

  const [formState, formAction] = useActionState<FormState, FormData>(
    createCleanUpNoticeAction,
    { success: false, message: '' }
  );

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast({
          title: 'Success',
          description: formState.message,
        });
        setOpen(false);
        form.reset();
        clearPhoto();
      } else {
        toast({
          title: 'Error',
          description: formState.message,
          variant: 'destructive',
        });
      }
    }
  }, [formState, toast, form]);

  useEffect(() => {
    if (!open) {
      setIsCameraOpen(false);
      clearPhoto();
      form.reset();
    }
  }, [open, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description:
            'Please enable camera permissions in your browser settings to use this feature.',
        });
      }
    };

    if (isCameraOpen) {
      getCameraPermission();
    }

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraOpen, toast]);

  const selectedClientId = form.watch('clientId');
  const photoUrl = form.watch('photoUrl');

  useEffect(() => {
    if (selectedClientId) {
      setFilteredProjects(
        projects.filter((p) => p.clientId === selectedClientId)
      );
      form.setValue('projectId', '');
    } else {
      setFilteredProjects([]);
    }
  }, [selectedClientId, projects, form]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;

      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      form.setValue('photoUrl', dataUrl);
      form.setValue('photoTimestamp', new Date().toISOString());
      setIsCameraOpen(false);
    }
  };

  const clearPhoto = () => {
    form.setValue('photoUrl', '');
    form.setValue('photoTimestamp', '');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Notice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record New Clean Up Notice</DialogTitle>
          <DialogDescription>
            Capture an issue that requires cleaning and assign it to a sub-contractor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            onSubmit={form.handleSubmit(() => formRef.current?.submit())}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('photoUrl')} />
            <input type="hidden" {...form.register('photoTimestamp')} />
            
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!selectedClientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
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
                  <FormLabel>Description of Issue</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Debris from drywall installation on floor 12..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Photo</FormLabel>
              {photoUrl ? (
                <div className="space-y-2">
                  <Image
                    src={photoUrl}
                    alt="Clean up photo preview"
                    width={600}
                    height={400}
                    className="rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearPhoto}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retake Photo
                  </Button>
                </div>
              ) : isCameraOpen ? (
                <div className="space-y-2">
                  {hasCameraPermission === false ? (
                    <Alert variant="destructive">
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Please allow camera access to use this feature.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          playsInline
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={takePhoto}
                        disabled={hasCameraPermission === undefined}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Add Photo
                </Button>
              )}
            </FormItem>

            <Separator />
            
            <FormItem>
              <div className="mb-4">
                <FormLabel>Email Sub-Contractors</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Select which sub-contractors to notify.
                </p>
              </div>
              <div className="space-y-2">
              {subContractors.map((user) => (
                <FormField
                  key={user.id}
                  control={form.control}
                  name="recipients"
                  render={({ field }) => {
                    return (
                      <FormItem
                        key={user.id}
                        className="flex flex-row items-center space-x-3 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(user.id)}
                            onCheckedChange={(checked) => {
                              const updatedValue = field.value ? [...field.value] : [];
                              if (checked) {
                                updatedValue.push(user.id);
                              } else {
                                const index = updatedValue.indexOf(user.id);
                                if (index > -1) {
                                  updatedValue.splice(index, 1);
                                }
                              }
                              field.onChange(updatedValue);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {user.name} <span className="text-muted-foreground">({user.email})</span>
                        </FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
              </div>
              <FormMessage />
            </FormItem>

            <canvas ref={canvasRef} className="hidden" />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving...'
                  : 'Save Notice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
