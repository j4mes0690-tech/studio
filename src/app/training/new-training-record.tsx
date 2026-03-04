'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Save, Camera, Upload, X, RefreshCw } from 'lucide-react';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { DistributionUser, Photo, TrainingRecord } from '@/lib/types';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';

const NewRecordSchema = z.object({
  userEmail: z.string().email('Select an employee.'),
  courseName: z.string().min(3, 'Course name is required.'),
  certificateNumber: z.string().optional(),
  issueDate: z.string().min(1, 'Issue date is required.'),
  expiryDate: z.string().min(1, 'Expiry date is required.'),
});

type NewRecordFormValues = z.infer<typeof NewRecordSchema>;

export function NewTrainingRecord({ users, currentUser, canManageAll }: { 
  users: DistributionUser[]; 
  currentUser: DistributionUser;
  canManageAll: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<NewRecordFormValues>({
    resolver: zodResolver(NewRecordSchema),
    defaultValues: {
      userEmail: canManageAll ? '' : currentUser.email,
      courseName: '',
      certificateNumber: '',
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
    },
  });

  const onSubmit = (values: NewRecordFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading evidence and saving record...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `training/certificates/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const targetUser = users.find(u => u.email === values.userEmail);

        const recordData: Omit<TrainingRecord, 'id'> = {
          ...values,
          userId: targetUser?.id || values.userEmail,
          userName: targetUser?.name || 'Unknown',
          photos: uploadedPhotos,
          createdAt: new Date().toISOString(),
        };

        await addDoc(collection(db, 'training-records'), recordData);
        toast({ title: 'Success', description: 'Training certificate recorded.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save training record.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {}
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1200;
      canvas.height = 1200 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhotos([...photos, { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setPhotos([]);
      setIsCameraOpen(false);
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Add Certificate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Training Certificate</DialogTitle>
          <DialogDescription>Add a professional qualification to an employee's compliance profile.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="userEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canManageAll}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="certificateNumber" render={({ field }) => (
                <FormItem><FormLabel>Certificate No.</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="courseName" render={({ field }) => (
              <FormItem><FormLabel>Course / Qualification Name</FormLabel><FormControl><Input placeholder="e.g. SMSTS, First Aid at Work" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="issueDate" render={({ field }) => (
                <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="space-y-4">
              <FormLabel>Certificate Evidence (Photos/Scans)</FormLabel>
              <div className="flex flex-wrap gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-24 h-24 group">
                    <Image src={p.url} alt="Certificate" fill className="rounded-md object-cover border" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-24 h-24 flex flex-col gap-2 rounded-md border-dashed" onClick={() => setIsCameraOpen(true)}>
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Capture</span>
                </Button>
              </div>
              
              {isCameraOpen && (
                <div className="space-y-3 border-2 border-primary/20 rounded-xl p-3 bg-primary/5">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button type="button" onClick={capturePhoto}>Capture Certificate</Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Certificate
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
