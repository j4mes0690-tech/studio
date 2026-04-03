'use client';

import { useState, useTransition, useMemo } from 'react';
import type { IRSItem, Project, DistributionUser, SubContractor, Photo, ChatMessage } from '@/lib/types';
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
  Info,
  MessageSquareReply,
  RefreshCw,
  XCircle,
  EyeOff,
  Bell
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { RespondToIRS } from './respond-to-irs';
import { ImageLightbox } from '@/components/image-lightbox';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditIRSItemDialog } from './edit-irs-item';

function UpdateStatusButton({ item, currentUser }: { item: IRSItem, currentUser: DistributionUser }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();
    const [isMarkOpen, setIsMarkOpen] = useState(false);
    const [provDate, setProvDate] = useState(item.providedDate || new Date().toISOString().split('T')[0]);
    const [provDesc, setProvDesc] = useState(item.providedDescription || '');

    const handleUpdate = (newStatus: 'open' | 'provided') => {
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
                message: `Requirement ${newStatus === 'provided' ? 'resolved' : 'reopened'} by ${currentUser.name}.`,
                createdAt: new Date().toISOString(),
            };
            updates.messages = arrayUnion(systemMsg);

            await updateDoc(docRef, updates);
            toast({ title: 'Success', description: `Item ${newStatus}.` });
            setIsMarkOpen(false);
        });
    };

    if (item.status === 'provided') {
        return (
            <AlertDialog>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                    <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                                </Button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Reopen Requirement</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reopen Requirement?</AlertDialogTitle>
                        <AlertDialogDescription>This will clear the resolution data and return the item to the active schedule.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleUpdate('open')} disabled={isPending}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        );
    }

    return (
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
            <DialogContent className="sm:max-w-md" onClick={e => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Resolve Requirement</DialogTitle>
                    <DialogDescription>Record the details of the information provided.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Date Received</Label>
                        <Input type="date" value={provDate} onChange={e => setProvDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Answer / Deliverable Summary</Label>
                        <Textarea 
                            placeholder="How was this resolved?" 
                            value={provDesc} 
                            onChange={e => setProvDesc(e.target.value)} 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsMarkOpen(false)}>Cancel</Button>
                    <Button className="font-bold" onClick={() => handleUpdate('provided')} disabled={isPending || !provDesc}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Resolve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function IRSCard({ 
  item, 
  project, 
  users, 
  subContractors,
  currentUser
}: { 
  item: IRSItem; 
  project?: Project; 
  users: DistributionUser[];
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const email = currentUser?.email.toLowerCase().trim();

  // Attention Check
  const isAttentionRequired = useMemo(() => {
    if (!item || !email || item.status !== 'open') return false;
    if (item.dismissedBy?.includes(email)) return false;
    return item.assignedToEmail.toLowerCase().trim() === email;
  }, [item, email]);

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

  const handleDismissAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'irs-items', item.id);
    updateDoc(docRef, { dismissedBy: arrayUnion(email) })
        .then(() => toast({ title: 'Alert Dismissed', description: 'Item removed from your priority queue.' }));
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'irs-items', item.id));
      toast({ title: 'Removed', description: 'IRS item deleted.' });
    });
  };

  const sortedMessages = useMemo(() => 
    [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [item.messages]
  );

  return (
    <>
      <Card className={cn(
          "transition-all border-l-4 shadow-sm group",
          item.status === 'overdue' ? 'border-l-red-500' : 
          item.status === 'escalated' ? 'border-l-indigo-500' :
          item.status === 'provided' ? 'border-l-green-500 opacity-90' : 'border-l-primary',
          isAttentionRequired && "border-primary border-2 shadow-primary/10 bg-primary/[0.02] ring-1 ring-primary animate-in fade-in zoom-in"
      )}>
        <CardHeader className="pb-3 border-b">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary shrink-0">{item.reference}</Badge>
                <CardTitle className="text-base truncate group-hover:text-primary transition-colors">{item.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardDescription className="font-semibold text-foreground text-xs">{project?.name || 'Unknown Project'}</CardDescription>
                {isAttentionRequired && (
                    <Badge className="bg-primary text-white h-5 px-2 text-[9px] font-black uppercase tracking-widest animate-pulse gap-1.5">
                        <Bell className="h-2.5 w-2.5" />
                        Action Required
                    </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              {isAttentionRequired && (
                  <TooltipProvider>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleDismissAlert}>
                                  <EyeOff className="h-4 w-4" />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Dismiss Alert</p></TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
              )}

              <Badge className={cn(
                  "text-[9px] uppercase font-bold tracking-tight h-5",
                  item.status === 'provided' ? 'bg-green-100 text-green-800' :
                  item.status === 'escalated' ? 'bg-indigo-100 text-indigo-800' :
                  item.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              )}>
                  {item.status}
              </Badge>
              
              <RespondToIRS item={item} currentUser={currentUser} />
              <UpdateStatusButton item={item} currentUser={currentUser} />
              
              <EditIRSItemDialog 
                item={item} 
                projects={project ? [project] : []} 
                users={users} 
                subContractors={subContractors} 
              />

              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
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
        <CardContent className="space-y-4 pt-4">
          {item.description && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/10 p-2 rounded border border-dashed italic">"{item.description}"</p>}
          
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

          <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="messages" className="border-b-0">
                  <AccordionTrigger className="text-xs font-bold uppercase tracking-widest hover:no-underline py-2">
                      <div className="flex items-center gap-2">
                          <MessageSquareReply className="h-3.5 w-3.5 text-primary" />
                          <span>Implementation Thread ({sortedMessages.length})</span>
                      </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <div className="space-y-3 bg-muted/10 p-3 rounded-lg border shadow-inner">
                          {sortedMessages.map(msg => {
                              const isSystem = msg.senderEmail === 'system@sitecommand.internal';
                              const isMe = msg.senderEmail === currentUser.email.toLowerCase().trim();
                              
                              if (isSystem) {
                                  return (
                                      <div key={msg.id} className="flex justify-center my-1">
                                          <span className="bg-white/50 text-[8px] uppercase font-bold px-2 py-0.5 rounded-full text-muted-foreground border border-dashed">
                                              {msg.message}
                                          </span>
                                      </div>
                                  );
                              }

                              return (
                                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                      <div className={cn(
                                          "px-3 py-1.5 rounded-xl max-w-[90%] shadow-sm",
                                          isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white text-foreground rounded-tl-none border"
                                      )}>
                                          {!isMe && <p className="text-[9px] font-bold mb-0.5 text-primary">{msg.sender}</p>}
                                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                          
                                          {msg.photos && msg.photos.length > 0 && (
                                              <div className="flex gap-1 flex-wrap mt-2">
                                                  {msg.photos.map((p, idx) => (
                                                      <div key={idx} className="relative w-10 h-8 rounded overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                                          <Image src={p.url} alt="Thread" fill className="object-cover" />
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                          
                                          <div className="text-[8px] text-right mt-1 opacity-60">
                                              <ClientDate date={msg.createdAt} />
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                          {sortedMessages.length === 0 && (
                              <p className="text-[10px] text-center py-4 text-muted-foreground italic">No discussion yet. Use the Workspace button to post updates.</p>
                          )}
                      </div>
                  </AccordionContent>
              </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
