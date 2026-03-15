'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import type { TrainingNeed, DistributionUser, Photo, TrainingRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  Calendar, 
  User, 
  BookOpen, 
  Save, 
  ClipboardList, 
  Camera, 
  RefreshCw, 
  X, 
  Upload 
} from 'lucide-react';
import { useFirestore, useStorage } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import Image from 'next/image';
import { VoiceInput } from '@/components/voice-input';

export function TrainingNeeds({ needs, users, currentUser, canManageAll }: { 
  needs: TrainingNeed[]; 
  users: DistributionUser[]; 
  currentUser: DistributionUser;
  canManageAll: boolean;
}) {
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State for New Need
  const [course, setCourse] = useState('');
  const [targetEmail, setTargetEmail] = useState(canManageAll ? '' : currentUser.email);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  // Status Dialog States
  const [bookingNeedId, setBookingNeedId] = useState<string | null>(null);
  const [bookedDate, setBookedDate] = useState('');

  const [completingNeed, setCompletingNeed] = useState<TrainingNeed | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [certPhotos, setCertPhotos] = useState<Photo[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  const handleAddNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !targetEmail) return;

    startTransition(async () => {
      const user = users.find(u => u.email === targetEmail);
      const data = {
        userId: user?.id || targetEmail,
        userName: user?.name || 'Unknown',
        userEmail: targetEmail,
        courseName: course,
        priority,
        status: 'requested' as const,
        notes,
        requestedDate: new Date().toISOString()
      };

      const colRef = collection(db, 'training-needs');
      addDoc(colRef, data)
        .then(() => {
          toast({ title: 'Success', description: 'Training requirement flagged for admin team.' });
          setIsAddOpen(false);
          setCourse('');
          setNotes('');
        })
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data
          }));
        });
    });
  };

  const handleConfirmBooking = () => {
    if (!bookingNeedId || !bookedDate) return;
    startTransition(async () => {
      const docRef = doc(db, 'training-needs', bookingNeedId);
      updateDoc(docRef, { 
        status: 'booked',
        bookedDate: bookedDate 
      }).then(() => {
        toast({ title: 'Course Booked', description: 'Schedule updated.' });
        setBookingNeedId(null);
        setBookedDate('');
      });
    });
  };

  const handleCompleteTraining = () => {
    if (!completingNeed || !expiryDate) return;
    
    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Uploading certificate and closing requirement...' });

        const uploadedPhotos = await Promise.all(
          certPhotos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `training/certificates/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // 1. Create formal Training Record
        const recordData: Omit<TrainingRecord, 'id'> = {
          userId: completingNeed.userId,
          userName: completingNeed.userName,
          userEmail: completingNeed.userEmail,
          courseName: completingNeed.courseName,
          issueDate: new Date().toISOString().split('T')[0],
          expiryDate: expiryDate,
          photos: uploadedPhotos,
          createdAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'training-records'), recordData);

        // 2. Mark need as completed
        const needRef = doc(db, 'training-needs', completingNeed.id);
        await updateDoc(needRef, { status: 'completed' });

        toast({ title: 'Success', description: 'Training verified and record added.' });
        setCompletingNeed(null);
        setExpiryDate('');
        setCertPhotos([]);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to verify training.', variant: 'destructive' });
      }
    });
  };

  const deleteNeed = (id: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'training-needs', id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Removed', description: 'Requirement deleted.' }));
    });
  };

  // Camera Logic
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
      setCertPhotos([...certPhotos, { url: canvas.toDataURL('image/jpeg', 0.85), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const handleCertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = (re) => {
        setCertPhotos(prev => [...prev, { 
          url: re.target?.result as string, 
          takenAt: new Date().toISOString() 
        }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const filteredNeeds = canManageAll 
    ? (needs || []) 
    : (needs || []).filter(n => n.userEmail.toLowerCase() === currentUser.email.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Upcoming Requirements</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Flag Training Need
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Identify Training Gap</DialogTitle>
              <DialogDescription>Flag a required course for an employee to alert the booking team.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddNeed} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={targetEmail} onValueChange={setTargetEmail} disabled={!canManageAll}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Required Course</Label>
                    <VoiceInput onResult={setCourse} />
                </div>
                <Input placeholder="e.g. Asbestos Awareness" value={course} onChange={e => setCourse(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Non-urgent)</SelectItem>
                    <SelectItem value="medium">Medium (Next 6 months)</SelectItem>
                    <SelectItem value="high">High (Compliance Critical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Admin Notes</Label>
                <Textarea placeholder="Specific reasons or scheduling constraints..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Log Requirement
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {filteredNeeds.map((need) => (
          <Card key={need.id} className={cn(
            "transition-all border-l-4",
            need.priority === 'high' ? "border-l-red-500" : 
            need.priority === 'medium' ? "border-l-amber-500" : "border-l-blue-500"
          )}>
            <CardHeader className="py-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{need.courseName}</CardTitle>
                    <Badge variant="outline" className={cn(
                        "text-[9px] uppercase tracking-tighter h-4",
                        need.priority === 'high' ? "text-red-600 border-red-200 bg-red-50" :
                        need.priority === 'medium' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-blue-600 border-blue-200"
                    )}>
                        {need.priority} Priority
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-2 font-bold text-foreground text-xs uppercase">
                    <User className="h-3 w-3" /> {need.userName}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "capitalize text-[10px]",
                    need.status === 'requested' ? "bg-indigo-100 text-indigo-800" :
                    need.status === 'booked' ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  )}>
                    {need.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNeed(need.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              {need.notes && <p className="text-xs text-muted-foreground italic mb-4">"{need.notes}"</p>}
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/30 p-3 rounded-lg border border-dashed">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        <Calendar className="h-3 w-3" />
                        Requested: {new Date(need.requestedDate).toLocaleDateString()}
                    </div>
                    {need.bookedDate && (
                        <div className="flex items-center gap-2 text-[10px] text-amber-700 font-bold">
                            <BookOpen className="h-3 w-3" />
                            Course Date: {new Date(need.bookedDate).toLocaleDateString()}
                        </div>
                    )}
                </div>
                
                {canManageAll && need.status !== 'completed' && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        {need.status === 'requested' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => { setBookingNeedId(need.id); setBookedDate(new Date().toISOString().split('T')[0]); }}>
                                <BookOpen className="h-3 w-3" /> Mark as Booked
                            </Button>
                        )}
                        {need.status === 'booked' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-green-600 border-green-200 hover:bg-green-50" onClick={() => setCompletingNeed(need)}>
                                <Upload className="h-3 w-3" /> Upload Certificate
                            </Button>
                        )}
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredNeeds.length === 0 && (
          <div className="text-center py-20 bg-muted/5 border-2 border-dashed rounded-lg">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No pending training requirements.</p>
          </div>
        )}
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={!!bookingNeedId} onOpenChange={() => setBookingNeedId(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Confirm Course Booking</DialogTitle>
                <DialogDescription>A course date is required to move this requirement to "Booked" status.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label>Scheduled Training Date</Label>
                    <Input type="date" value={bookedDate} onChange={e => setBookedDate(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setBookingNeedId(null)}>Cancel</Button>
                <Button onClick={handleConfirmBooking} disabled={isPending || !bookedDate}>Confirm Booking</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion & Verification Dialog */}
      <Dialog open={!!completingNeed} onOpenChange={() => setCompletingNeed(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Verify Training Completion</DialogTitle>
                <DialogDescription>Upload the certificate to add this qualification to the compliance registry.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
                <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
                    <p className="text-sm font-bold text-primary">{completingNeed?.courseName}</p>
                    <p className="text-xs text-muted-foreground mt-1">Employee: {completingNeed?.userName}</p>
                </div>

                <div className="space-y-2">
                    <Label>Certification Expiry Date</Label>
                    <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                </div>

                <div className="space-y-4">
                    <Label>Evidence (Photos/Scans)</Label>
                    <div className="flex flex-wrap gap-2">
                        {certPhotos.map((p, i) => (
                            <div key={i} className="relative w-20 h-20 rounded-lg border overflow-hidden">
                                <Image src={p.url} alt="Cert" fill className="object-cover" />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-5 w-5 rounded-full" onClick={() => setCertPhotos(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
                            </div>
                        ))}
                        <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => setIsCameraOpen(true)}>
                            <Camera className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[8px] uppercase font-bold">Capture</span>
                        </Button>
                        <Button variant="outline" className="w-20 h-20 flex flex-col gap-1 border-dashed" onClick={() => certFileInputRef.current?.click()}>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[8px] uppercase font-bold">Upload</span>
                        </Button>
                        <input 
                            type="file" 
                            ref={certFileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            multiple 
                            onChange={handleCertFileSelect} 
                        />
                    </div>
                    {isCameraOpen && (
                        <div className="space-y-2 border rounded-md p-2 bg-muted/30">
                            <video ref={videoRef} className="w-full aspect-video bg-black rounded-md object-cover" autoPlay muted playsInline />
                            <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={capturePhoto}>Capture</Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')}><RefreshCw className="h-4 w-4" /></Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setCompletingNeed(null)}>Cancel</Button>
                <Button onClick={handleCompleteTraining} disabled={isPending || !expiryDate || certPhotos.length === 0}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Verify & Close Requirement
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
