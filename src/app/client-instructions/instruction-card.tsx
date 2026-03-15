'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { ClientInstruction, Project, DistributionUser, ChatMessage, Photo, SubContractor, FileAttachment, Instruction, InformationRequest } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  CheckSquare, 
  MessageCircle, 
  Trash2, 
  CheckCircle2, 
  FileText, 
  Download, 
  Maximize2, 
  ArrowRightLeft,
  HelpCircle,
  ClipboardList,
  Loader2,
  Plus,
  User,
  HardHat,
  X,
  ShieldCheck,
  Ruler,
  Users2,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '../../components/client-date';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RespondToInstruction } from './respond-to-instruction';
import { cn, getProjectInitials, getNextReference } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { sendClientInstructionEmailAction } from './actions';
import { Separator } from '@/components/ui/separator';

function ReopenInstructionButton({ instruction, currentUser }: { instruction: ClientInstruction, currentUser: DistributionUser }) {
    const { toast } = useToast();
    const db = useFirestore();
    const [isPending, startTransition] = useTransition();

    const handleReopen = (e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            const docRef = doc(db, 'client-instructions', instruction.id);
            const systemMessage: ChatMessage = {
                id: `system-${Date.now()}`,
                sender: 'System',
                senderEmail: 'system@sitecommand.internal',
                message: `Directive REOPENED by ${currentUser.name} for further clarification.`,
                createdAt: new Date().toISOString()
            };

            updateDoc(docRef, {
                status: 'open',
                messages: arrayUnion(systemMessage)
            }).then(() => {
                toast({ title: 'Directive Reopened', description: 'Communication workspace is now active.' });
            }).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: { status: 'open' }
                }));
            });
        });
    };

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                                <span className="sr-only">Reopen Directive</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reopen Directive</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reopen Client Directive?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will move the directive back to "Open" status, re-enabling the implementation thread for further questions or documentation.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReopen} disabled={isPending}>
                        Confirm Reopen
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AcceptInstructionButton({ 
    instruction, 
    currentUser, 
    projects,
    allSiteInstructions,
    allRfis
}: { 
    instruction: ClientInstruction, 
    currentUser: DistributionUser, 
    projects: Project[],
    allSiteInstructions: Instruction[],
    allRfis: InformationRequest[]
}) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const db = useFirestore();
    const [isPending, startTransition] = useTransition();

    const [rfis, setRfis] = useState<{ description: string, assignedTo: string[] }[]>([]);
    const [siteInsts, setSiteInsts] = useState<{ description: string, subcontractorId: string }[]>([]);

    useEffect(() => {
        if (!open) {
            setRfis([]);
            setSiteInsts([]);
        }
    }, [open]);

    const subsQuery = useMemoFirebase(() => {
        if (!db) return null;
        return collection(db, 'sub-contractors');
    }, [db]);
    const { data: allSubs } = useCollection<SubContractor>(subsQuery);
    
    const usersQuery = useMemoFirebase(() => {
        if (!db) return null;
        return collection(db, 'users');
    }, [db]);
    const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

    const project = useMemo(() => projects.find(p => p.id === instruction.projectId), [projects, instruction.projectId]);
    const initials = useMemo(() => getProjectInitials(project?.name || 'PRJ'), [project]);
    
    // PROJECT-RESTRICTED FILTERS
    const projectStaff = useMemo(() => {
        if (!allUsers || !project) return [];
        const assignedEmails = project.assignedUsers || [];
        return allUsers.filter(u => assignedEmails.some(e => e.toLowerCase().trim() === u.email.toLowerCase().trim()));
    }, [allUsers, project]);

    const projectExternalPartners = useMemo(() => {
        if (!allSubs || !project) return [];
        const projectSubIds = project.assignedSubContractors || [];
        return allSubs.filter(s => projectSubIds.includes(s.id));
    }, [allSubs, project]);

    const handleAddRfi = () => setRfis([...rfis, { description: `Clarification for ${instruction.reference}`, assignedTo: [] }]);
    const handleAddInst = () => setSiteInsts([...siteInsts, { description: `Implementation of ${instruction.reference}`, subcontractorId: '' }]);

    const handleAccept = () => {
        startTransition(async () => {
            try {
                const docRef = doc(db, 'client-instructions', instruction.id);
                
                const systemMessage: ChatMessage = {
                    id: `system-${Date.now()}`,
                    sender: 'System',
                    senderEmail: 'system@sitecommand.internal',
                    message: `Directive ACCEPTED. Generated ${rfis.length} RFIs and ${siteInsts.length} Instructions.`,
                    createdAt: new Date().toISOString()
                };

                updateDoc(docRef, {
                    status: 'accepted',
                    messages: arrayUnion(systemMessage)
                }).catch(err => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'update',
                        requestResourceData: { status: 'accepted' }
                    }));
                });

                // Track local counts to avoid collisions within the same batch
                let currentRfis = [...allRfis];
                let currentSis = [...allSiteInstructions];

                rfis.forEach(rfi => {
                    const isInternal = projectStaff.some(u => rfi.assignedTo.includes(u.email.toLowerCase().trim()));
                    const prefix = isInternal ? 'CRFI' : 'RFI';
                    const reference = getNextReference(currentRfis, instruction.projectId, prefix, initials);

                    const rfiData = {
                        reference,
                        projectId: instruction.projectId,
                        clientInstructionId: instruction.id,
                        description: rfi.description,
                        assignedTo: rfi.assignedTo.map(e => e.toLowerCase().trim()),
                        raisedBy: currentUser.email.toLowerCase().trim(),
                        createdAt: new Date().toISOString(),
                        status: 'open',
                        messages: [],
                        photos: instruction.photos || [],
                        files: instruction.files || []
                    };
                    
                    // Add to local list to correctly calculate next number if multiple RFIs added
                    currentRfis.push(rfiData as any);

                    addDoc(collection(db, 'information-requests'), rfiData).catch(err => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: 'information-requests',
                            operation: 'create',
                            requestResourceData: rfiData
                        }));
                    });
                });

                siteInsts.forEach(si => {
                    const sub = allSubs?.find(s => s.id === si.subcontractorId);
                    const reference = getNextReference(currentSis, instruction.projectId, 'SI', initials);

                    const siData = {
                        reference,
                        projectId: instruction.projectId,
                        clientInstructionId: instruction.id,
                        originalText: instruction.originalText,
                        summary: si.description,
                        actionItems: instruction.actionItems,
                        createdAt: new Date().toISOString(),
                        photos: instruction.photos || [],
                        recipients: sub ? [sub.email] : [],
                        status: 'draft' // Site instructions generated from CI start as draft
                    };

                    currentSis.push(siData as any);

                    addDoc(collection(db, 'instructions'), siData).catch(err => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: 'instructions',
                            operation: 'create',
                            requestResourceData: siData
                        }));
                    });
                });

                // Broadcast acceptance to the project team
                const projectRecipients = project?.assignedUsers || [];
                if (projectRecipients.length > 0) {
                  await sendClientInstructionEmailAction({
                    emails: projectRecipients,
                    projectName: project?.name || 'Project',
                    reference: instruction.reference,
                    status: 'accepted',
                    text: instruction.originalText,
                    summary: instruction.summary
                  });
                }

                toast({ title: 'Success', description: 'Directive processed and team notified.' });
                setOpen(false);
            } catch (err) {
                console.error(err);
                toast({ title: 'Error', description: 'Failed to process acceptance.', variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-green-600 border-green-200 hover:bg-green-50" onClick={(e) => e.stopPropagation()}>
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Directive
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <DialogHeader className="p-6 pb-0 flex-none">
                    <DialogTitle>Action Workspace: {instruction.reference}</DialogTitle>
                    <DialogDescription>
                        Assign follow-up tasks to project members and partners. Accepting will automatically notify the project team.
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8 pb-10">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex items-center gap-2">
                                    <HelpCircle className="h-5 w-5 text-primary" />
                                    <h3 className="font-bold">Information Requests (CRFI / RFI)</h3>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddRfi} className="h-7 px-2">
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Inquiry
                                </Button>
                            </div>
                            
                            {rfis.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No technical queries added.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {rfis.map((rfi, idx) => (
                                        <div key={idx} className="p-4 border rounded-lg bg-muted/10 space-y-4 relative group">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                                                onClick={() => setRfis(rfis.filter((_, i) => i !== idx))}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Inquiry Details</Label>
                                                <Input 
                                                    value={rfi.description} 
                                                    onChange={(e) => setRfis(rfis.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))}
                                                    className="text-sm h-8"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Project Assignee</Label>
                                                <Select 
                                                    onValueChange={(val) => setRfis(rfis.map((r, i) => i === idx ? { ...r, assignedTo: [val.split(':')[1]] } : r))}
                                                    value={rfi.assignedTo[0] ? (projectStaff.some(u => u.email === rfi.assignedTo[0]) ? `staff:${rfi.assignedTo[0]}` : `partner:${rfi.assignedTo[0]}`) : ""}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select Project Recipient" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                          <SelectLabel className="flex items-center gap-2 text-primary">
                                                            <ShieldCheck className="h-3 w-3" /> Project Staff
                                                          </SelectLabel>
                                                          {projectStaff.length === 0 ? (
                                                              <div className="p-2 text-[10px] text-muted-foreground italic">No staff assigned to project</div>
                                                          ) : projectStaff.map(u => (
                                                              <SelectItem key={`staff-${u.id}`} value={`staff:${u.email}`}>{u.name} ({u.email})</SelectItem>
                                                          ))}
                                                        </SelectGroup>
                                                        <Separator className="my-1" />
                                                        <SelectGroup>
                                                          <SelectLabel className="flex items-center gap-2 text-accent">
                                                            <Users2 className="h-3 w-3" /> Trade Partners
                                                          </SelectLabel>
                                                          {projectExternalPartners.length === 0 ? (
                                                              <div className="p-2 text-[10px] text-muted-foreground italic">No partners assigned to project</div>
                                                          ) : projectExternalPartners.map(p => (
                                                              <SelectItem key={`partner-${p.id}`} value={`partner:${p.email}`}>{p.name} ({p.email})</SelectItem>
                                                          ))}
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-accent" />
                                    <h3 className="font-bold">Internal Site Instructions</h3>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddInst} className="h-7 px-2">
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Instruction
                                </Button>
                            </div>

                            {siteInsts.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No instructions drafted.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {siteInsts.map((si, idx) => (
                                        <div key={idx} className="p-4 border rounded-lg bg-muted/10 space-y-4 relative group">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                                                onClick={() => setSiteInsts(siteInsts.filter((_, i) => i !== idx))}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Trade Instruction</Label>
                                                <Input 
                                                    value={si.description} 
                                                    onChange={(e) => setSiteInsts(siteInsts.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                                                    className="text-sm h-8"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Assigned Trade</Label>
                                                <Select 
                                                    onValueChange={(val) => setSiteInsts(siteInsts.map((s, i) => i === idx ? { ...s, subcontractorId: val } : s))}
                                                    value={si.subcontractorId}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Assign trade" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {projectExternalPartners.length === 0 ? (
                                                            <div className="p-2 text-[10px] text-muted-foreground italic">No sub-contractors assigned to project</div>
                                                        ) : projectExternalPartners.map(s => (
                                                            <SelectItem key={`si-sub-${s.id}`} value={s.id}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-muted/5 border-t flex-none gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAccept} disabled={isPending} className="bg-green-600 hover:bg-green-700 font-bold min-w-[180px]">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                        Accept & Create Actions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ClientInstructionCard({ 
    instruction, 
    projects, 
    currentUser,
    allSiteInstructions,
    allRfis
}: { 
    instruction: ClientInstruction, 
    projects: Project[], 
    currentUser: DistributionUser,
    allSiteInstructions: Instruction[],
    allRfis: InformationRequest[]
}) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  // Determine if navigation is needed (only if not already on the detail page)
  const isDetailPage = pathname === `/client-instructions/${instruction.id}`;

  const handleCardClick = () => {
    if (!isDetailPage) {
      router.push(`/client-instructions/${instruction.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'client-instructions', instruction.id);
    deleteDoc(docRef).then(() => {
        toast({ title: 'Success', description: 'Record deleted.' });
        if (isDetailPage) router.push('/client-instructions');
    });
  };

  const isAccepted = instruction.status === 'accepted';
  const sortedMessages = useMemo(() => [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [instruction.messages]);

  return (
    <>
      <Card 
        className={cn(
            "border-l-4 transition-all", 
            isAccepted ? "border-l-green-500 bg-green-50/10" : "border-l-primary",
            !isDetailPage && "cursor-pointer hover:shadow-md hover:border-l-primary/80 group/card"
        )}
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className={cn("text-xl transition-colors", !isDetailPage && "group-hover/card:text-primary")}>
                    {project?.name || 'Unknown'}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">{instruction.reference}</Badge>
              </div>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                  <ClientDate date={instruction.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Badge variant={isAccepted ? "secondary" : "default"} className={cn(isAccepted && "bg-green-100 text-green-800 border-green-200")}>
                  {isAccepted ? "Accepted" : "Open Directive"}
              </Badge>
              {!isAccepted ? (
                <AcceptInstructionButton 
                    instruction={instruction} 
                    currentUser={currentUser} 
                    projects={projects} 
                    allSiteInstructions={allSiteInstructions}
                    allRfis={allRfis}
                />
              ) : (
                <ReopenInstructionButton instruction={instruction} currentUser={currentUser} />
              )}
              <RespondToInstruction instruction={instruction} currentUser={currentUser} />
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/20 rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">
                  <MessageCircle className="h-3 w-3" /> <span>Implementation Thread</span>
              </div>
              <div className="bg-background px-4 py-3 rounded-2xl rounded-tl-none border shadow-sm max-w-[95%]">
                  <p className="text-[10px] font-bold mb-1 text-primary uppercase">Initial Client Directive</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{instruction.originalText}</p>
                  
                  {instruction.photos && instruction.photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                      {instruction.photos.map((p, i) => (
                        <div 
                            key={i} 
                            className="relative aspect-video rounded-lg overflow-hidden border cursor-pointer group/photo" 
                            onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}
                        >
                          <Image src={p.url} alt="Site" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {instruction.files && instruction.files.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {instruction.files.map((f, i) => (
                        <a 
                            key={i} 
                            href={f.url} 
                            download={f.name} 
                            className="flex items-center gap-2 p-2 rounded text-[10px] bg-muted border text-primary hover:bg-accent"
                            onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="h-3.5 w-3.5" /> <span className="truncate flex-1 font-medium">{f.name}</span> <Download className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
              </div>
              {sortedMessages.map((msg) => {
                  const isMe = msg.senderEmail === currentUser.email.toLowerCase().trim();
                  const isSystem = msg.senderEmail === 'system@sitecommand.internal';
                  if (isSystem) return <div key={msg.id} className="flex justify-center my-2"><Badge variant="outline" className="bg-background text-[10px] py-0.5 px-3 rounded-full border-dashed font-semibold text-muted-foreground">{msg.message}</Badge></div>;
                  return (
                      <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                          <div className={cn("relative px-4 py-2 rounded-2xl max-w-[90%] shadow-sm", isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none border")}>
                              {!isMe && <p className="text-[10px] font-bold mb-1 text-primary">{msg.sender}</p>}
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                              {msg.photos?.map((p, i) => (
                                <div 
                                    key={i} 
                                    className="relative aspect-video rounded-lg overflow-hidden border bg-background mt-2 cursor-pointer group/photo" 
                                    onClick={(e) => { e.stopPropagation(); setViewingPhoto(p); }}
                                >
                                  <Image src={p.url} alt="Update photo" fill className="object-cover" />
                                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                                </div>
                              ))}
                              {msg.files?.map((f, i) => (
                                <a 
                                    key={i} 
                                    href={f.url} 
                                    download={f.name} 
                                    className={cn("flex items-center gap-2 p-1.5 rounded text-[9px] mt-2 border", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : "bg-background border-border text-primary")}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{f.name}</span>
                                </a>
                              ))}
                              <div className={cn("text-[9px] mt-2", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}><ClientDate date={msg.createdAt} /></div>
                          </div>
                      </div>
                  );
              })}
          </div>
        </CardContent>
      </Card>
      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
