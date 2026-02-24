
'use client';

import { useState, useMemo, useTransition } from 'react';
import type { ClientInstruction, Project, DistributionUser, ChatMessage, Photo, SubContractor } from '@/lib/types';
import Image from 'next/image';
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
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '../../components/client-date';
import { useFirestore, useCollection } from '@/firebase';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RespondToInstruction } from './respond-to-instruction';
import { cn, generateReference } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function AcceptInstructionButton({ instruction, currentUser, projects }: { instruction: ClientInstruction, currentUser: DistributionUser, projects: Project[] }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const db = useFirestore();
    const [isPending, startTransition] = useTransition();

    const [rfis, setRfis] = useState<{ description: string, assignedTo: string[] }[]>([]);
    const [siteInsts, setSiteInsts] = useState<{ description: string, subcontractorId: string }[]>([]);

    const subsQuery = useMemo(() => collection(db, 'sub-contractors'), [db]);
    const { data: allSubs } = useCollection<SubContractor>(subsQuery);
    
    const usersQuery = useMemo(() => collection(db, 'users'), [db]);
    const { data: allUsers } = useCollection<DistributionUser>(usersQuery);

    const project = useMemo(() => projects.find(p => p.id === instruction.projectId), [projects, instruction.projectId]);
    
    const projectSubs = useMemo(() => {
        if (!allSubs || !project) return [];
        const projectSubIds = project.assignedSubContractors || [];
        return allSubs.filter(s => projectSubIds.includes(s.id));
    }, [allSubs, project]);

    const handleAddRfi = () => setRfis([...rfis, { description: `Clarification needed for ${instruction.reference}`, assignedTo: [] }]);
    const handleAddInst = () => setSiteInsts([...siteInsts, { description: `Implementation of ${instruction.reference}`, subcontractorId: '' }]);

    const handleAccept = () => {
        startTransition(async () => {
            try {
                const docRef = doc(db, 'client-instructions', instruction.id);
                
                const systemMessage: ChatMessage = {
                    id: `system-${Date.now()}`,
                    sender: 'System',
                    senderEmail: 'system@sitecommand.internal',
                    message: `Instruction ACCEPTED by ${currentUser.name}. Generated ${rfis.length} RFIs and ${siteInsts.length} Site Instructions.`,
                    createdAt: new Date().toISOString()
                };

                // Non-blocking update
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

                // Generate triggered actions
                rfis.forEach(rfi => {
                    const rfiData = {
                        projectId: instruction.projectId,
                        clientInstructionId: instruction.id,
                        description: rfi.description,
                        assignedTo: rfi.assignedTo,
                        raisedBy: currentUser.email.toLowerCase().trim(),
                        createdAt: new Date().toISOString(),
                        status: 'open',
                        messages: [],
                        photos: instruction.photos || []
                    };
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
                    const siData = {
                        reference: generateReference('SI'),
                        projectId: instruction.projectId,
                        clientInstructionId: instruction.id,
                        originalText: instruction.originalText,
                        summary: si.description,
                        actionItems: instruction.actionItems,
                        createdAt: new Date().toISOString(),
                        photos: instruction.photos || [],
                        recipients: sub ? [sub.email] : []
                    };
                    addDoc(collection(db, 'instructions'), siData).catch(err => {
                        errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: 'instructions',
                            operation: 'create',
                            requestResourceData: siData
                        }));
                    });
                });

                toast({ title: 'Success', description: 'Directive accepted and actions triggered.' });
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
                <Button variant="outline" size="sm" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Directive
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Accept Client Directive: {instruction.reference}</DialogTitle>
                    <DialogDescription>
                        Generate and link follow-up site actions in one go.
                    </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="flex-1 p-6 space-y-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-primary" />
                                <h3 className="font-bold">Requests for Information (RFIs)</h3>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddRfi} className="h-7 px-2">
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add RFI
                            </Button>
                        </div>
                        
                        {rfis.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No technical clarifications required.</p>
                        ) : (
                            <div className="space-y-4">
                                {rfis.map((rfi, idx) => (
                                    <div key={idx} className="p-3 border rounded-lg bg-muted/10 space-y-3 relative group">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                                            onClick={() => setRfis(rfis.filter((_, i) => i !== idx))}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">RFI Query</Label>
                                            <Input 
                                                value={rfi.description} 
                                                onChange={(e) => setRfis(rfis.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))}
                                                className="text-sm h-8"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Assign To</Label>
                                            <Select 
                                                onValueChange={(val) => setRfis(rfis.map((r, i) => i === idx ? { ...r, assignedTo: [val] } : r))}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select team member" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allUsers?.map(u => <SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>)}
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
                                <h3 className="font-bold">Sub-contractor Instructions</h3>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddInst} className="h-7 px-2">
                                <Plus className="h-3.5 w-3.5 mr-1" /> Add Instruction
                            </Button>
                        </div>

                        {siteInsts.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No instructions to distribute yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {siteInsts.map((si, idx) => (
                                    <div key={idx} className="p-3 border rounded-lg bg-muted/10 space-y-3 relative group">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                                            onClick={() => setSiteInsts(siteInsts.filter((_, i) => i !== idx))}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Site Task</Label>
                                            <Input 
                                                value={si.description} 
                                                onChange={(e) => setSiteInsts(siteInsts.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                                                className="text-sm h-8"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sub-contractor</Label>
                                            <Select 
                                                onValueChange={(val) => setSiteInsts(siteInsts.map((s, i) => i === idx ? { ...s, subcontractorId: val } : s))}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Assign trade" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {projectSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-muted/5 border-t gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleAccept} disabled={isPending} className="bg-green-600 hover:bg-green-700 font-bold min-w-[180px]">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                        Confirm & Trigger
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ClientInstructionCard({ instruction, projects, currentUser }: { instruction: ClientInstruction, projects: Project[], currentUser: DistributionUser }) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const handleDelete = () => {
    const docRef = doc(db, 'client-instructions', instruction.id);
    deleteDoc(docRef).then(() => toast({ title: 'Success', description: 'Record deleted.' }));
  };

  const isAccepted = instruction.status === 'accepted';
  const sortedMessages = useMemo(() => [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [instruction.messages]);

  return (
    <>
      <Card className={cn("border-l-4 transition-all hover:shadow-md", isAccepted ? "border-l-green-500 bg-green-50/10" : "border-l-primary")}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{project?.name || 'Unknown'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">{instruction.reference}</Badge>
              </div>
              <CardDescription className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                  <ClientDate date={instruction.createdAt} />
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isAccepted ? "secondary" : "default"} className={cn(isAccepted && "bg-green-100 text-green-800 border-green-200")}>
                  {isAccepted ? "Accepted" : "Open Directive"}
              </Badge>
              {!isAccepted && <AcceptInstructionButton instruction={instruction} currentUser={currentUser} projects={projects} />}
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
          <p className="text-sm font-semibold text-foreground mb-4">{instruction.summary}</p>
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
                        <div key={i} className="relative aspect-video rounded-lg overflow-hidden border cursor-pointer group" onClick={() => setViewingPhoto(p)}>
                          <Image src={p.url} alt="Site" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="h-5 w-5 text-white" /></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {instruction.files && instruction.files.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {instruction.files.map((f, i) => (
                        <a key={i} href={f.url} download={f.name} className="flex items-center gap-2 p-2 rounded text-[10px] bg-muted border text-primary hover:bg-accent">
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
                              <p className="text-sm leading-snug whitespace-pre-wrap">{msg.message}</p>
                              {msg.photos?.map((p, i) => (
                                <div key={i} className="relative aspect-video rounded-lg overflow-hidden border bg-background mt-2 cursor-pointer" onClick={() => setViewingPhoto(p)}>
                                  <Image src={p.url} alt="Update photo" fill className="object-cover" />
                                </div>
                              ))}
                              <div className={cn("text-[9px] mt-2", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}><ClientDate date={msg.createdAt} /></div>
                          </div>
                      </div>
                  );
              })}
          </div>
          <Accordion type="single" collapsible className="w-full mt-4">
            <AccordionItem value="action-items">
                <AccordionTrigger className="text-sm font-semibold">
                    <div className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> <span>Extracted Action Items ({instruction.actionItems.length})</span></div>
                </AccordionTrigger>
                <AccordionContent><ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">{instruction.actionItems.map((item, index) => <li key={index}>{item}</li>)}</ul></AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
