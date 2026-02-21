
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
import { updateInformationRequestAction, type FormState } from './actions';
import { Pencil, Camera, RefreshCw } from 'lucide-react';
import type { Client, Project, InformationRequest, DistributionUser } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const EditInformationRequestSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.string().min(1, 'Please assign this request to a user.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
});

type EditInformationRequestFormValues = z.infer<typeof EditInformationRequestSchema>;

type EditInformationRequestProps = {
  item: InformationRequest;
  clients: Client[];
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function EditInformationRequest({ item, clients, projects, distributionUsers }: EditInformationRequestProps) {
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
  const assignedUserId = distributionUsers.find(u => u.email === item.assignedTo)?.id || '';

  const form = useForm<EditInformationRequestFormValues>({
    resolver: zodResolver(EditInformationRequestSchema),
    defaultValues: {
      id: item.id,
      clientId: item.clientId,
      projectId: item.projectId,
      description: item.description,
      assignedTo: assignedUserId,
      photoUrl: item.photo?.url || '',
      photoTimestamp: item.photo?.takenAt || '',
    },
  });

  const [formState, formAction, isPending] = useActionState<FormState, FormData>(
    updateInformationRequestAction,
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
      } else {
        toast({
          title: 'Error',
          description: formState.message,
          variant: 'destructive',
        });
      }
    }
  }, [formState, toast]);

  useEffect(() => {
    if (!open) {
      setIsCameraOpen(false);
      form.reset({
        id: item.id,
        clientId: item.clientId,
        projectId: item.projectId,
        description: item.description,
        assignedTo: assignedUserId,
        photoUrl: item.photo?.url || '',
        photoTimestamp: item.photo?.takenAt || '',
      });
    }
  }, [open, form, item, assignedUserId]);

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
    } else {
      setFilteredProjects([]);
    }
  }, [selectedClientId, projects, form]);
  
  // Set project on initial load if client is already selected
  useEffect(() => {
     setFilteredProjects(
        projects.filter((p) => p.clientId === item.clientId)
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.clientId, projects])

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
        <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit Request</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Information Request</DialogTitle>
          <DialogDescription>
            Update the details for this information request.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            onSubmit={form.handleSubmit(() => formRef.current?.requestSubmit())}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <input type="hidden" {...form.register('photoUrl')} />
            <input type="hidden" {...form.register('photoTimestamp')} />
            
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('projectId', '');
                    }}
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
                  <FormLabel>Information Requested</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Client requires updated floor plans for level 3..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user to assign the request" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {distributionUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    alt="Information request photo"
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
                    Change Photo
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
            
            <canvas ref={canvasRef} className="hidden" />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
