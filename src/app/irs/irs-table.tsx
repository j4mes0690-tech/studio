
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { IRSItem, Project, DistributionUser, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  Trash2, 
  Calendar, 
  Loader2, 
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  Check,
  ArrowRight,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export function IRSTable({ 
  items, 
  projects, 
  users, 
  subContractors 
}: { 
  items: IRSItem[]; 
  projects: Project[]; 
  users: DistributionUser[];
  subContractors: SubContractor[];
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Ref</TableHead>
            <TableHead>Required Information</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[150px]">Assigned To</TableHead>
            <TableHead className="w-[120px]">Target Date</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <IRSRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              users={users} 
              subContractors={subContractors} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function IRSRow({ 
  item, 
  projects, 
  users, 
  subContractors 
}: { 
  item: IRSItem; 
  projects: Project[]; 
  users: DistributionUser[];
  subContractors: SubContractor[];
}) {
  const project = projects.find(p => p.id === item.projectId);
  const assignedPerson = users.find(u => u.email === item.assignedToEmail) || subContractors.find(s => s.email === item.assignedToEmail);
  
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  
  const [provDate, setProvDate] = useState(new Date().toISOString().split('T')[0]);
  const [provDesc, setProvDesc] = useState('');

  const ragStatus = useMemo(() => {
    if (item.status === 'provided' || item.status === 'escalated') return null;
    const today = startOfDay(new Date());
    const required = startOfDay(parseISO(item.requiredByDate));
    const daysUntil = differenceInDays(required, today);
    if (daysUntil < 0) return { color: 'text-red-600', icon: AlertTriangle };
    if (daysUntil <= item.notificationLeadDays) return { color: 'text-amber-600', icon: Clock };
    return { color: 'text-green-600', icon: CheckCircle2 };
  }, [item]);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'irs-items', item.id));
      toast({ title: 'Deleted', description: 'IRS item removed.' });
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
      toast({ title: 'Success', description: 'Requirement resolved.' });
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
    });
  };

  return (
    <TableRow className={cn(item.status === 'provided' && "opacity-60 grayscale")}>
      <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
      <TableCell className="font-medium truncate max-w-[250px]" title={item.title}>{item.title}</TableCell>
      <TableCell className="truncate max-w-[150px] text-xs text-muted-foreground">{project?.name || 'Unknown'}</TableCell>
      <TableCell className="truncate max-w-[150px]">
        <div className="flex items-center gap-1.5 text-xs">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">{assignedPerson?.name || item.assignedToEmail}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className={cn("flex items-center gap-1.5 text-xs font-bold", ragStatus?.color)}>
            {ragStatus?.icon && <ragStatus.icon className="h-3 w-3" />}
            <ClientDate date={item.requiredByDate} format="date" />
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn(
            "capitalize text-[10px] font-bold h-5",
            item.status === 'provided' ? 'bg-green-100 text-green-800' :
            item.status === 'escalated' ? 'bg-indigo-100 text-indigo-800' :
            item.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
        )}>
            {item.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {item.status === 'escalated' && item.escalatedRfiId && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-indigo-600">
                <Link href={`/information-requests/${item.escalatedRfiId}`} title="View Linked RFI">
                    <MessageSquare className="h-4 w-4" />
                </Link>
            </Button>
          )}
          
          {item.status === 'provided' ? (
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-green-600"
                onClick={handleReopen}
                disabled={isPending}
            >
                <CheckCircle2 className="h-4 w-4" />
            </Button>
          ) : (
            <Dialog open={isMarkOpen} onOpenChange={setIsMarkOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Check className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resolve Requirement</DialogTitle>
                        <DialogDescription>Provide details for the audit log.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Date Received</Label>
                            <Input type="date" value={provDate} onChange={e => setProvDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Details</Label>
                            <Textarea placeholder="How was this resolved?" value={provDesc} onChange={e => setProvDesc(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsMarkOpen(false)}>Cancel</Button>
                        <Button className="font-bold" onClick={handleMarkProvided} disabled={isPending || !provDate}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Resolve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-opacity">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Confirm Removal</AlertDialogTitle><AlertDialogDescription>Permanently remove this IRS item?</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
