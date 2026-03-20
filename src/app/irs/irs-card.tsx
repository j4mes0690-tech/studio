
'use client';

import { useState, useTransition, useMemo } from 'react';
import type { IRSItem, Project, DistributionUser, SubContractor } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  Loader2,
  Check,
  History,
  Info
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

export function IRSCard({ 
  item, 
  project, 
  users, 
  subContractors 
}: { 
  item: IRSItem; 
  project?: Project; 
  users: DistributionUser[];
  subContractors: SubContractor[];
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  
  // Resolution Form State
  const [provDate, setProvDate] = useState(item.providedDate || new Date().toISOString().split('T')[0]);
  const [provDesc, setProvDesc] = useState(item.providedDescription || '');

  const assignedPerson = useMemo(() => {
    return users.find(u => u.email === item.assignedToEmail) || subContractors.find(s => s.email === item.assignedToEmail);
  }, [users, subContractors, item.assignedToEmail]);

  const ragStatus = useMemo(() => {
    if (item.status === 'provided' || item.status === 'escalated') return null;
    
    const today = startOfDay(new Date());
    const required = startOfDay(parseISO(item.requiredByDate));
    const daysUntil = differenceInDays(required, today);
    
    if (daysUntil < 0) return { color: 'text-red-600', bg: 'bg-red-50', label: 'OVERDUE', icon: AlertTriangle };
    if (daysUntil <= item.notificationLeadDays) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'WARNING PERIOD', icon: Clock };
    return { color: 'text-green-600', bg: 'bg-green-50', label: 'ON TRACK', icon: CheckCircle2 };
  }, [item]);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'irs-items', item.id));
      toast({ title: 'Removed', description: 'IRS item deleted.' });
    });
  };

  const handleMarkProvided = () => {
    startTransition(async () => {
      const docRef = doc(db, 'irs-items', item.id);
      await updateDoc(docRef, {
        status: 'provided',
        providedDate: provDate,
        providedDescription: provDesc
      });
      setIsMarkOpen(false);
      toast({ title: 'Resolution Logged', description: 'Item marked as provided with details.' });
    });
  };

  const handleReopen = () => {
    startTransition(async () => {
      const docRef = doc(db, 'irs-items', item.id);
      await updateDoc(docRef, { 
        status: 'open',
        providedDate: null,
        providedDescription: null
      });
      toast({ title: 'Requirement Reopened', description: 'Resolution data cleared.' });
    });
  };

  return (
    <>
      <Card className={cn(
          "transition-all hover:border-primary border-l-4 shadow-sm group",
          item.status === 'overdue' ? 'border-l-red-500' : 
          item.status === 'escalated' ? 'border-l-indigo-500' :
          item.status === 'provided' ? 'border-l-green-500 opacity-90' : 'border-l-primary'
      )}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary shrink-0">{item.reference}</Badge>
                <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{item.title}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-2">
                <span className="font-semibold text-foreground text-xs">{project?.name || 'Unknown Project'}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={cn(
                  "text-[9px] uppercase font-bold tracking-tight",
                  item.status === 'provided' ? 'bg-green-100 text-green-800' :
                  item.status === 'escalated' ? 'bg-indigo-100 text-indigo-800' :
                  item.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              )}>
                  {item.status}
              </Badge>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete IRS Item?</AlertDialogTitle><AlertDialogDescription>Permanently remove this requirement from the project schedule.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
          
          <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Required From</p>
                  <p className="font-bold truncate flex items-center gap-1.5">
                      <User className="h-3 w-3 text-primary" />
                      {assignedPerson?.name || item.assignedToEmail}
                  </p>
              </div>
              <div className="space-y-1 text-right">
                  <p className="font-bold text-muted-foreground uppercase tracking-widest">Target Date</p>
                  <p className={cn("font-bold flex items-center justify-end gap-1.5", (item.status === 'open' && ragStatus?.label === 'OVERDUE') && "text-red-600")}>
                      <Calendar className="h-3 w-3" />
                      <ClientDate date={item.requiredByDate} format="date" />
                  </p>
              </div>
          </div>

          {item.status === 'provided' && (
              <div className="bg-green-50/50 border-2 border-green-100 rounded-xl p-4 space-y-3 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-green-700 tracking-[0.2em] flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Information Received
                      </p>
                      <Badge variant="outline" className="text-[9px] bg-white border-green-200 text-green-700 font-black">
                          {item.providedDate ? new Date(item.providedDate).toLocaleDateString() : 'N/A'}
                      </Badge>
                  </div>
                  <p className="text-xs text-green-800 leading-relaxed font-medium bg-white/50 p-2 rounded-md border border-green-100">
                      {item.providedDescription || 'Information provided per project requirements.'}
                  </p>
                  <Button variant="ghost" className="w-full h-7 text-[9px] font-bold uppercase text-green-700 hover:bg-green-100" onClick={handleReopen} disabled={isPending}>
                      Reset Status & Clear Answer
                  </Button>
              </div>
          )}

          {ragStatus && (
              <div className={cn("px-3 py-1.5 rounded-md flex items-center justify-between", ragStatus.bg)}>
                  <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", ragStatus.color)}>
                      <ragStatus.icon className="h-3.5 w-3.5" />
                      {ragStatus.label}
                  </div>
                  <span className={cn("text-[10px] font-bold", ragStatus.color)}>
                      Lead: {item.notificationLeadDays} days
                  </span>
              </div>
          )}

          {item.status === 'escalated' && item.escalatedRfiId && (
              <Button asChild variant="outline" className="w-full h-9 gap-2 text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 font-bold">
                  <Link href={`/information-requests/${item.escalatedRfiId}`}>
                      <MessageSquare className="h-4 w-4" />
                      View Linked RFI
                      <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Link>
              </Button>
          )}

          {item.status !== 'provided' && (
              <Dialog open={isMarkOpen} onOpenChange={setIsMarkOpen}>
                  <DialogTrigger asChild>
                      <Button variant="outline" className="w-full h-9 gap-2 font-bold hover:border-primary hover:text-primary">
                          <Check className="h-4 w-4" />
                          Mark as Provided
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                          <DialogTitle>Resolve Requirement</DialogTitle>
                          <DialogDescription>Record the details of the information provided to satisfy this schedule item.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Date Received</Label>
                              <Input 
                                type="date" 
                                value={provDate} 
                                onChange={e => setProvDate(e.target.value)} 
                              />
                          </div>
                          <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase text-muted-foreground">Answer / Deliverable Summary</Label>
                              <Textarea 
                                placeholder="e.g. Layout drawing issue P02 received and reviewed." 
                                className="min-h-[100px]"
                                value={provDesc}
                                onChange={e => setProvDesc(e.target.value)}
                              />
                          </div>
                      </div>
                      <DialogFooter>
                          <Button variant="ghost" onClick={() => setIsMarkOpen(false)}>Cancel</Button>
                          <Button className="font-bold gap-2" onClick={handleMarkProvided} disabled={isPending || !provDate}>
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Commit to Audit Log
                          </Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>
          )}
        </CardContent>
      </Card>
    </>
  );
}
