'use client';

import { useState, useTransition } from 'react';
import type { TrainingNeed, DistributionUser } from '@/lib/types';
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
  Check,
  Save
} from 'lucide-react';
import { useFirestore } from '@/firebase';
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

export function TrainingNeeds({ needs, users, currentUser, canManageAll }: { 
  needs: TrainingNeed[]; 
  users: DistributionUser[]; 
  currentUser: DistributionUser;
  canManageAll: boolean;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State for New Need
  const [course, setCourse] = useState('');
  const [targetEmail, setTargetEmail] = useState(canManageAll ? '' : currentUser.email);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

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

  const updateStatus = (id: string, newStatus: TrainingNeed['status']) => {
    startTransition(async () => {
      const docRef = doc(db, 'training-needs', id);
      updateDoc(docRef, { status: newStatus })
        .then(() => toast({ title: 'Status Updated', description: `Requirement is now ${newStatus}.` }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { status: newStatus }
          }));
        });
    });
  };

  const deleteNeed = (id: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'training-needs', id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Removed', description: 'Requirement deleted.' }))
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete'
          }));
        });
    });
  };

  const filteredNeeds = canManageAll 
    ? needs 
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
                <Label>Required Course</Label>
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
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                    <Calendar className="h-3 w-3" />
                    Requested: {new Date(need.requestedDate).toLocaleDateString()}
                </div>
                
                {canManageAll && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        {need.status === 'requested' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => updateStatus(need.id, 'booked')}>
                                <BookOpen className="h-3 w-3" /> Mark as Booked
                            </Button>
                        )}
                        {need.status === 'booked' && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(need.id, 'completed')}>
                                <Check className="h-3 w-3" /> Training Completed
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
    </div>
  );
}
