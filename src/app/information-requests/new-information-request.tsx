'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';

import { cn } from '@/lib/utils';
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
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createInformationRequestAction } from './actions';
import { PlusCircle, Camera, Upload, X, CalendarIcon } from 'lucide-react';
import type { Project, DistributionUser, Photo } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

const NewInformationRequestSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  photos: z.string().optional(),
  requiredBy: z.string().optional(),
});

type NewInformationRequestFormValues = z.infer<typeof NewInformationRequestSchema>;

type NewInformationRequestProps = {
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function NewInformationRequest({ projects, distributionUsers }: NewInformationRequestProps) {
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | undefined
  >();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);

  const form = useForm<NewInformationRequestFormValues>({
    resolver: zodResolver(NewInformationRequestSchema),
    defaultValues: {
      projectId: '',
      description: '',
      assignedTo: [],
      photos: '',
      requiredBy: undefined,
    },
  });

  useEffect(() => {
    form.setValue('photos', JSON.stringify(photos));
  }, [photos, form]);

  const onSubmit = (values: NewInformationRequestFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('projectId', values.projectId);
      formData.append('description', values.description);
      values.assignedTo.forEach(id => formData.append('assignedTo', id));
      if (values.photos) formData.append('photos', values.photos);
      if (values.requiredBy) formData.append('requiredBy', values.requiredBy);

      const result = await createInformationRequestAction(formData);

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        setOpen(false);
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
      setPhotos([]);
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
      
      setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPhotos(prev => [...prev, { url: dataUrl, takenAt: new Date().toISOString() }]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log New Information Request</DialogTitle>
          <DialogDescription>
            Record a request for information and assign it to a team member.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('photos')} />
            
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
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
                      placeholder="e.g., Updated floor plans for level 3..."
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
              name="requiredBy"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Required By (Optional)</FormLabel>
                  <Dialog
                    open={calendarOpen}
                    onOpenChange={setCalendarOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant={'outline'}
                        className={cn(
                          'w-[240px] justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? (
                          format(new Date(field.value), 'PPP')
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          field.onChange(date ? date.toISOString() : undefined);
                          setCalendarOpen(false);
                        }}
                        initialFocus
                      />
                    </DialogContent>
                  </Dialog>
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
                                  return checked
                                    ? field.onChange([...(field.value || []), user.id])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== user.id
                                        )
                                      );
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
              <FormLabel>Photos</FormLabel>
              <div className="space-y-4">
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={photo.url}
                          alt={`Photo ${index + 1}`}
                          width={200}
                          height={150}
                          className="rounded-md border object-cover aspect-video"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              
                {isCameraOpen ? (
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
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={takePhoto}
                            disabled={hasCameraPermission === undefined}
                          >
                            <Camera className="mr-2 h-4 w-4" />
                            Take Photo
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsCameraOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </div>
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
