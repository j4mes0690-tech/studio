'use client';

import { useState, useTransition, useMemo } from 'react';
import type { InformationRequest, Project, DistributionUser, ChatMessage, Photo } from '@/lib/types';
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
import { Camera, Users, MessageSquareReply, CalendarClock, XCircle, RefreshCw, Trash2, Maximize2, Link as LinkIcon, ExternalLink } from 'lucide-react';
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
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';


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
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Update Status?</AlertDialogTitle><AlertDialogDescription>Change RFI status to {newStatus}.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUpdate} disabled={isPending}>Confirm</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function InformationRequestCard({ item, projects, distributionUsers, currentUser }: { item: InformationRequest, projects: Project[], distributionUsers: DistributionUser[], currentUser: DistributionUser }) {
  const project = projects.find((p) => p.id === item.projectId);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const db = useFirestore();
  const { toast } = useToast();

  const assignedToArray = useMemo(() => Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []), [item.assignedTo]);
  const sortedMessages = [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start border-b pb-4">
            <Link href={`/information-requests/${item.id}`} className="space-y-1 flex-1 group">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{project?.name || 'Unknown Project'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">{item.reference}</Badge>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground/80 font-medium">Opened <ClientDate date={item.createdAt} format="date" /></span>
                  {item.clientInstructionId && <Badge variant="outline" className="text-[9px] gap-1 h-4 px-1.5"><LinkIcon className="h-2 w-2" /> Linked to Client Directive</Badge>}
              </CardDescription>
              {item.requiredBy && <div className="flex items-center gap-2 text-xs text-destructive mt-2 font-semibold"><CalendarClock className="h-4 w-4" /><span>Due: <ClientDate date={item.requiredBy} format="date" /></span></div>}
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className='capitalize'>{item.status}</Badge>
              {item.status === 'open' ? <RespondToRequest item={item} distributionUsers={distributionUsers} currentUser={currentUser} /> : null}
              <UpdateStatusButton requestId={item.id} newStatus={item.status === 'open' ? 'closed' : 'open'} currentUser={currentUser} />
              <EditInformationRequest item={item} projects={projects} distributionUsers={distributionUsers} />
              <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'information-requests', item.id)).then(() => toast({ title: 'Deleted' }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-muted/30 p-4 rounded-lg border mb-6">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inquiry</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="assigned-to">
                <AccordionTrigger className="text-sm font-semibold"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span>Assigned To ({assignedToArray.length})</span></div></AccordionTrigger>
                <AccordionContent><div className="flex flex-wrap gap-1">{assignedToArray.map((email, i) => <Badge key={i} variant="outline" className="bg-background">{email}</Badge>)}</div></AccordionContent>
            </AccordionItem>
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
                                        {msg.photos?.map((p, i) => <div key={i} className="relative aspect-video rounded-lg overflow-hidden border mt-2 cursor-pointer" onClick={() => setViewingPhoto(p)}><Image src={p.url} alt="U" fill className="object-cover" /></div>)}
                                        <div className={cn("text-[9px] mt-1 opacity-70")}><ClientDate date={msg.createdAt} /></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </AccordionContent>
            </AccordionItem>
            {item.photos && item.photos.length > 0 && (
              <AccordionItem value="photo">
                <AccordionTrigger className="text-sm font-semibold"><div className="flex items-center gap-2"><Camera className="h-4 w-4" /><span>Visual Assets ({item.photos.length})</span></div></AccordionTrigger>
                <AccordionContent>
                  <Carousel className="w-full max-w-sm mx-auto">
                    <CarouselContent>{item.photos.map((photo, i) => <CarouselItem key={i}><div className="relative aspect-video rounded-md overflow-hidden border cursor-pointer" onClick={() => setViewingPhoto(photo)}><Image src={photo.url} alt="Site" fill className="object-cover" /><div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100"><Maximize2 className="h-6 w-6 text-white" /></div></div></CarouselItem>)}</CarouselContent>
                    <CarouselPrevious /><CarouselNext />
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
