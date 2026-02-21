
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
import { createInformationRequestAction } from './actions';
import { PlusCircle, Camera, RefreshCw } from 'lucide-react';
import type { Client, Project, DistributionUser } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

const NewInformationRequestSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
});

type NewInformationRequestFormValues = z.infer<typeof NewInformationRequestSchema>;

type NewInformationRequestProps = {
  clients: Client[];
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function NewInformationRequest({ clients, projects, distributionUsers }: NewInformationRequestProps) {
  const [open, setOpen] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | undefined
  >();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewInformationRequestFormValues>({
    resolver: zodResolver(NewInformationRequestSchema),
    defaultValues: {
      clientId: '',
      projectId: '',
      description: '',
      assignedTo: [],
      photoUrl: '',
      photoTimestamp: '',
    },
  });

  const onSubmit = (values: NewInformationRequestFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('clientId', values.clientId);
      formData.append('projectId', values.projectId);
      formData.append('description', values.description);
      values.assignedTo.forEach(id => formData.append('assignedTo', id));
      if (values.photoUrl) formData.append('photoUrl', values.photoUrl);
      if (values.photoTimestamp) formData.append('photoTimestamp', values.photoTimestamp);

      const result = await createInformationRequestAction(formData);

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        setOpen(false);
        form.reset();
        clearPhoto();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

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
          New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log New Information Request</DialogTitle>
          <DialogDescription>
            Record a client's request for information and assign it to a team member.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
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

            <FormItem>
              <div className="mb-4">
                <FormLabel>Assign To</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Select who to assign this request to.
                </p>
              </div>
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-4 space-y-2">
                  {distributionUsers.map((user) => (
                    <FormField
                      key={user.id}
                      control={form.control}
                      name="assignedTo"
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
              </ScrollArea>
              <FormMessage />
            </FormItem>
            

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
            
            <canvas ref={canvasRef} className="hidden" />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : 'Save Request'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
