
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
import type { IRSItem, Project, DistributionUser, SubContractor, ChatMessage } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
  Save,
  MessageSquareReply,
  RefreshCw,
  EyeOff,
  Bell,
  Pencil
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
import { RespondToIRS } from './respond-to-irs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditIRSItemDialog } from './edit-irs-item';

export function IRSTable({ 
  items, 
  projects, 
  users, 
  subContractors,
  currentUser
}: { 
  items: IRSItem[]; 
  projects: Project[]; 
  users: DistributionUser[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
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
            <TableHead className="w-[80px] text-center">Chat</TableHead>
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
              currentUser={currentUser}
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
  subContractors,
  currentUser
}: { 
  item: IRSItem; 
  projects: Project[]; 
  users: DistributionUser[]; 
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === item.projectId);
  const assignedPerson = users.find(u => u.email === item.assignedToEmail) || subContractors.find(s => s.email === item.assignedToEmail);
  
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  
  const [provDate, setProvDate] = useState(item.providedDate || new Date().toISOString().split('T')[0]);
  const [provDesc, setProvDesc] = useState(item.providedDescription || '');

  const email = currentUser?.email.toLowerCase().trim();

  // Attention Check
  const isAttentionRequired = useMemo(() => {
    if (!item || !email || item.status !== 'open') return false;
    if (item.dismissedBy?.includes(email)) return false;
    return item.assignedToEmail.toLowerCase().trim() === email;
  }, [item, email]);

  const ragStatus = useMemo(() => {
    if (item.status === 'provided' || item.status === 'escalated') return null;
    const today = startOfDay(new Date());
    const required = startOfDay(parseISO(item.requiredByDate));
    const daysUntil = differenceInDays(required, today);
    if (daysUntil < 0) return { color: 'text-red-600', icon: AlertTriangle };
    if (daysUntil <= item.notificationLeadDays) return { color: 'text-amber-600', icon: Clock };
    return { color: 'text-green-600', icon: CheckCircle2 };
  }, [item]);

  const handleDismissAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'irs-items', item.id);
    updateDoc(docRef, { dismissedBy: arrayUnion(email) });
  };

  const handleUpdateStatus = (newStatus: 'open' | 'provided') => {
    startTransition(async () => {
      const docRef = doc(db, 'irs-items', item.id);
      const updates: any = { 
        status: newStatus,
        dismissedBy: [] 
      };

      if (newStatus === 'provided') {
          updates.providedDate = provDate;
          updates.providedDescription = provDesc;
      } else {
          updates.providedDate = null;
          updates.providedDescription = null;
      }

      const systemMsg: ChatMessage = {
        id: `msg-system-${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@sitecommand.internal',
        message: newStatus === 'provided' 
          ? `Requirement resolved by ${currentUser.name}.`
          : `Requirement reopened by ${currentUser.name}`,
        createdAt: new Date().toISOString(),
      };
      updates.messages = arrayUnion(systemMsg);

      await updateDoc(docRef, updates);
      toast({ title: 'Success', description: `Item ${newStatus}.` });
      setIsMarkOpen(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'irs-items', item.id));
      toast({ title: 'Deleted', description: 'IRS item removed.' });
    });
  };

  return (
    <TableRow className={cn(item.status === 'provided' && "opacity-60 grayscale")}>
      <TableCell className="font-mono text-[10px]">
          <div className="flex items-center gap-2">
              {isAttentionRequired && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
              {item.reference}
          </div>
      </TableCell>
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
      <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <MessageSquareReply className="h-3 w-3" />
              {item.messages?.length || 0}
          </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <TooltipProvider>
            {isAttentionRequired && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8 hover:text-primary" onClick={handleDismissAlert}>
                            <EyeOff className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Dismiss Alert</p></TooltipContent>
                </Tooltip>
            )}

            <RespondToIRS item={item} currentUser={currentUser} />

            {item.status === 'provided' ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleUpdateStatus('open')}
                            disabled={isPending}
                        >
                            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Reopen Requirement</p></TooltipContent>
                </Tooltip>
            ) : (
                <Dialog open={isMarkOpen} onOpenChange={setIsMarkOpen}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Mark as Provided</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <DialogContent onClick={e => e.stopPropagation()}>
                        <DialogHeader>
                            <DialogTitle>Resolve Requirement</DialogTitle>
                            <DialogDescription>Provide details for the audit log.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Date Received</Label>
                                <Input type="date" value={provDate} onChange={e => setProvDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Details</Label>
                                <Textarea placeholder="How was this resolved?" value={provDesc} onChange={e => setProvDesc(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsMarkOpen(false)}>Cancel</Button>
                            <Button className="font-bold" onClick={() => handleUpdateStatus('provided')} disabled={isPending || !provDesc}>
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Resolve
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <EditIRSItemDialog 
                item={item} 
                projects={project ? [project] : []} 
                users={users} 
                subContractors={subContractors} 
            />

            <AlertDialog>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Item</p></TooltipContent>
                </Tooltip>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader><AlertDialogTitle>Delete IRS Item?</AlertDialogTitle><AlertDialogDescription>Permanently remove this requirement from the schedule.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}
