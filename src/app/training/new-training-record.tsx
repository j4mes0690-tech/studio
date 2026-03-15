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
import { CameraOverlay } from '@/components/camera-overlay';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [photos, setPhotos] = useState<Photo[]>([]);

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
        toast({ title: 'Processing', description: 'Uploading evidence...' });

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
        const recordData = {
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
        toast({ title: 'Error', description: 'Failed to save record.', variant: 'destructive' });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
      reader.readAsDataURL(f);
    });
  };

  useEffect(() => { if (!open) { setPhotos([]); form.reset(); } }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button className="gap-2"><PlusCircle className="h-4 w-4" />Add Certificate</Button></DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Training Certificate</DialogTitle>
            <DialogDescription>Add a professional qualification to an employee's profile.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="userEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canManageAll}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger></FormControl>
                      <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="certificateNumber" render={({ field }) => (
                  <FormItem><FormLabel>Certificate No.</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="courseName" render={({ field }) => (
                <FormItem><FormLabel>Course Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="space-y-4">
                <FormLabel>Certificate Evidence</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 group">
                      <Image src={p.url} alt="Cert" fill className="rounded-md object-cover border" />
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => setIsCameraOpen(true)}><Camera className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Photo</span></Button>
                  <Button type="button" variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => fileInputRef.current?.click()}><Upload className="h-5 w-5" /><span className="text-[8px] uppercase font-bold">Upload</span></Button>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Certificate</Button>
              </DialogFooter>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
        title="Employee Certificate Capture"
      />
    </>
  );
}
