'use client';

import { useState, useTransition, useMemo } from 'react';
import type { InformationRequest, Project, DistributionUser, ChatMessage, Photo, SubContractor } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Camera, Users, MessageSquareReply, CalendarClock, XCircle, RefreshCw, Trash2, Maximize2, Link as LinkIcon, ExternalLink, FileText, Download, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EditInformationRequest } from './edit-information-request';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { RespondToRequest } from './respond-to-request';
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
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ClientDate } from '../../components/client-date';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn, getPartnerEmails } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';
import { sendInformationRequestEmailAction } from './actions';
import { generateInformationRequestPDF } from '@/lib/pdf-utils';

/**
 * DistributeRequestButton - Triggers manual email notification for an open RFI with PDF attachment.
 */
function DistributeRequestButton({ item, project, distributionUsers, subContractors }: { item: InformationRequest, project?: Project, distributionUsers: DistributionUser[], subContractors: SubContractor[] }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDistribute = (e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            try {
                const targetEmail = item.assignedTo[0];
                const sub = subContractors?.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
                const recipientEmails = new Set<string>();
                recipientEmails.add(targetEmail.toLowerCase().trim());

                if (sub) {
                    const partnerUsers = getPartnerEmails(sub.id, subContractors || [], distributionUsers);
                    partnerUsers.forEach(e => recipientEmails.add(e));
                }

                // Generate PDF for attachment (now includes photos and file registry)
                const assignedToNames = item.assignedTo.map(email => distributionUsers.find(u => u.email === email)?.name || email);
                const pdf = await generateInformationRequestPDF(item, project, assignedToNames);
                const pdfBase64 = pdf.output('datauristring').split(',')[1];

                const result = await sendInformationRequestEmailAction({
                    emails: Array.from(recipientEmails),
                    projectName: project?.name || 'Project',
                    reference: item.reference,
                    description: item.description,
                    raisedBy: distributionUsers.find(u => u.email === item.raisedBy)?.name || item.raisedBy,
                    requestId: item.id,
                    pdfBase64,
                    fileName: `RFI-${item.reference}.pdf`,
                    additionalFiles: item.files || []
                });

                if (result.success) {
                    toast({ title: 'Success', description: 'Request, PDF and technical files distributed.' });
                } else {
                    toast({ title: 'Error', description: result.message, variant: 'destructive' });
                }
            } catch (err) {
                console.error(err);
                toast({ title: 'Error', description: 'Failed to send notification.', variant: 'destructive' });
            }
        });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary" onClick={handleDistribute} disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Distribute via Email</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function UpdateStatusButton({ requestId, newStatus, currentUser }: { requestId: string, newStatus: 'open' | 'closed', currentUser: DistributionUser }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleUpdate = () => {
        startTransition(async () => {
            const docRef = doc(db, 'information-requests', requestId);
            const updates: any = { status: newStatus, dismissedBy: [] };
            const systemMsg: ChatMessage = {
                id: `msg-system-${Date.now()}`,
                sender: 'System',
                senderEmail: 'system@sitecommand.internal',
                message: `Request ${newStatus} by ${currentUser.name}.`,
                createdAt: new Date().toISOString(),
            };
            updates.messages = arrayUnion(systemMsg);
            updateDoc(docRef, updates).then(() => toast({ title: 'Success', description: `Request ${newStatus}.` }));
        });
    };

    const isClosing = newStatus === 'closed';

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                {isClosing ? <XCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>{isClosing ? 'Close' : 'Reopen'} Request</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>{isClosing ? 'Close Information Request?' : 'Reopen Information Request?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isClosing 
                            ? "This will mark the technical query as resolved. The implementation thread will remain as an audit record." 
                            : "This will move the request back to 'Open' status, allowing for further technical clarification and responses."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUpdate} disabled={isPending}>Confirm Status Update</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function InformationRequestCard({ 
  item, 
  projects, 
  distributionUsers, 
  currentUser,
  onDelete 
}: { 
  item: InformationRequest, 
  projects: Project[], 
  distributionUsers: DistributionUser[], 
  currentUser: DistributionUser,
  onDelete?: () => void
}) {
  const project = projects.find((p) => p.id === item.projectId);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubs } = useCollection<SubContractor>(subsQuery);

  const assignedToArray = useMemo(() => Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []), [item.assignedTo]);
  const sortedMessages = useMemo(() => [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [item.messages]);

  const isDraft = item.status === 'draft';

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'information-requests', item.id);
      deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Deleted', description: 'Information request removed.' });
          if (onDelete) onDelete();
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleIssue = () => {
    const hasText = item.description && item.description.trim().length >= 10;
    const hasRecipients = item.assignedTo && item.assignedTo.length > 0;

    if (!hasText || !hasRecipients) {
      toast({ 
        title: "Requirements Not Met", 
        description: "A full description (min 10 chars) and at least one recipient are required to formally log this request.", 
        variant: "destructive" 
      });
      setIsEditDialogOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        const docRef = doc(db, 'information-requests', item.id);
        await updateDoc(docRef, { status: 'open' });

        const targetEmail = item.assignedTo[0];
        const sub = allSubs?.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
        const recipientEmails = new Set<string>();
        recipientEmails.add(targetEmail.toLowerCase().trim());

        if (sub) {
            const partnerUsers = getPartnerEmails(sub.id, allSubs || [], distributionUsers);
            partnerUsers.forEach(e => recipientEmails.add(e));
        }

        // Generate PDF for attachment (now includes photos and file registry)
        const assignedToNames = item.assignedTo.map(email => distributionUsers.find(u => u.email === email)?.name || email);
        const pdf = await generateInformationRequestPDF(item, project, assignedToNames);
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        await sendInformationRequestEmailAction({
            emails: Array.from(recipientEmails),
            projectName: project?.name || 'Project',
            reference: item.reference,
            description: item.description,
            raisedBy: distributionUsers.find(u => u.email === item.raisedBy)?.name || item.raisedBy,
            requestId: item.id,
            pdfBase64,
            fileName: `RFI-${item.reference}.pdf`,
            additionalFiles: item.files || []
        });

        toast({ title: 'Success', description: 'Request formally logged and distributed with PDF and attachments.' });
      } catch (error) {
        console.error(error);
        const permissionError = new FirestorePermissionError({
          path: `information-requests/${item.id}`,
          operation: 'update',
          requestResourceData: { status: 'open' }
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    });
  };

  return (
    <>
      <Card className={cn(isDraft && "border-orange-200 bg-orange-50/10")}>
        <CardHeader>
          <div className="flex justify-between items-start border-b pb-4">
            <div className="space-y-1 flex-1 min-w-0">
              <Link href={`/information-requests/${item.id}`} className="group flex items-center gap-2 w-fit">
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{project?.name || 'Unknown Project'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">{item.reference}</Badge>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground/80 font-medium">Captured <ClientDate date={item.createdAt} format="date" /></span>
                  {item.clientInstructionId && (
                    <Link href={`/client-instructions/${item.clientInstructionId}`} onClick={(e) => e.stopPropagation()}>
                      <Badge variant="outline" className="text-[9px] gap-1 h-4 px-1.5 hover:bg-muted transition-colors cursor-pointer">
                        <LinkIcon className="h-2 w-2" /> Linked to Client Directive
                      </Badge>
                    </Link>
                  )}
              </CardDescription>
              {item.requiredBy && <div className="flex items-center gap-2 text-xs text-destructive mt-2 font-semibold"><CalendarClock className="h-4 w-4" /><span>Due: <ClientDate date={item.requiredBy} format="date" /></span></div>}
            </div>
            <div className="flex items-center gap-2">
              {isDraft ? (
                <>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">DRAFT</Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"
                    onClick={handleIssue}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Issue Request
                  </Button>
                </>
              ) : (
                <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className='capitalize'>{item.status}</Badge>
              )}
              
              {!isDraft && item.status === 'open' && (
                  <div className="flex items-center gap-1">
                      <DistributeRequestButton item={item} project={project} distributionUsers={distributionUsers} subContractors={allSubs || []} />
                      <RespondToRequest item={item} currentUser={currentUser} />
                  </div>
              )}
              {!isDraft && <UpdateStatusButton requestId={item.id} newStatus={item.status === 'open' ? 'closed' : 'open'} currentUser={currentUser} />}
              
              <EditInformationRequest 
                item={item} 
                projects={projects} 
                distributionUsers={distributionUsers} 
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              />
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Delete Request</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Information Request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this RFI record and its message history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                      {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-muted/30 p-4 rounded-lg border mb-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inquiry</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-4">{item.description || <span className="italic text-muted-foreground">No description provided</span>}</p>
              
              {/* Request Attachments */}
              {(item.files && item.files.length > 0) && (
                <div className="space-y-1 border-t pt-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Technical Documentation</p>
                  {item.files.map((f, i) => (
                    <a key={i} href={f.url} download={f.name} className="flex items-center gap-2 p-2 rounded text-[10px] bg-background border text-primary hover:bg-accent group">
                      <FileText className="h-3.5 w-3.5" /> 
                      <span className="truncate flex-1 font-medium">{f.name}</span> 
                      <Download className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
          </div>
          <Accordion type="single" collapsible className="w-full">
            {assignedToArray.length > 0 && (
              <AccordionItem value="assigned-to">
                  <AccordionTrigger className="text-sm font-semibold"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span>Assigned To ({assignedToArray.length})</span></div></AccordionTrigger>
                  <AccordionContent><div className="flex flex-wrap gap-1">{assignedToArray.map((email, i) => <Badge key={i} variant="outline" className="bg-background">{email}</Badge>)}</div></AccordionContent>
              </AccordionItem>
            )}
            {!isDraft && sortedMessages.length > 0 && (
              <AccordionItem value="conversation">
                  <AccordionTrigger className="text-sm font-semibold"><div className="flex items-center gap-2"><MessageSquareReply className="h-4 w-4" /><span>Thread ({sortedMessages.length})</span></div></AccordionTrigger>
                  <AccordionContent className="pt-4">
                      <div className="space-y-4">
                          {sortedMessages.map((msg) => {
                              const isSystem = msg.senderEmail === 'system@sitecommand.internal';
                              const isMe = msg.senderEmail === currentUser.email.toLowerCase().trim();
                              if (isSystem) return <div key={msg.id} className="flex justify-center"><Badge variant="outline" className="text-[10px]">{msg.message}</Badge></div>;
                              return (
                                  <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                      <div className={cn("relative px-4 py-2 rounded-2xl max-w-[85%] shadow-sm", isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none border")}>
                                          {!isMe && <p className="text-[10px] font-bold mb-1 text-primary">{msg.sender}</p>}
                                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                          
                                          {/* Message Media */}
                                          {msg.photos?.map((p, i) => <div key={i} className="relative aspect-video rounded-lg overflow-hidden border mt-2 cursor-pointer" onClick={() => setViewingPhoto(p)}><Image src={p.url} alt="U" fill className="object-cover" /></div>)}
                                          {msg.files?.map((f, i) => (
                                            <a key={i} href={f.url} download={f.name} className={cn("flex items-center gap-2 p-1.5 rounded text-[9px] mt-2 border", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : "bg-background border-border text-primary")}>
                                              <FileText className="h-3 w-3" />
                                              <span className="truncate max-w-[150px]">{f.name}</span>
                                            </a>
                                          ))}

                                          <div className={cn("text-[9px] mt-1 opacity-70")}><ClientDate date={msg.createdAt} /></div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </AccordionContent>
              </AccordionItem>
            )}
            {item.photos && item.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold"><div className="flex items-center gap-2"><Camera className="h-4 w-4" /><span>Visual Assets ({item.photos.length})</span></div></AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>{item.photos.map((photo, i) => <CarouselItem key={i}><div className="relative aspect-video rounded-md overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(photo)}><Image src={photo.url} alt="Site" fill className="object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100"><Maximize2 className="h-6 w-6 text-white" /></div></div></CarouselItem>)}</CarouselContent>
                    {item.photos.length > 1 && <><CarouselPrevious /><CarouselNext /></>}
                  </Carousel>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
