'use client';

import type { InformationRequest, Project, DistributionUser, ChatMessage } from '@/lib/types';
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
import { Camera, Users, MessageSquareReply, CalendarClock, XCircle, RefreshCw, Trash2 } from 'lucide-react';
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
import { useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ClientDate } from '../../components/client-date';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';


function UpdateStatusButton({ requestId, newStatus, currentUser }: { requestId: string, newStatus: 'open' | 'closed', currentUser: DistributionUser }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleUpdate = () => {
        startTransition(async () => {
            const docRef = doc(db, 'information-requests', requestId);
            
            const updates: any = { 
                status: newStatus,
                dismissedBy: [] // Reset notification dismissal on status change
            };

            if (newStatus === 'closed') {
                const closingMessage: ChatMessage = {
                    id: `msg-system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    sender: 'System',
                    senderEmail: 'system@sitecommand.internal',
                    message: `Request closed by ${currentUser.name}. Thank you all for your input.`,
                    createdAt: new Date().toISOString(),
                };
                updates.messages = arrayUnion(closingMessage);
            } else if (newStatus === 'open') {
                const reopeningMessage: ChatMessage = {
                    id: `msg-system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    sender: 'System',
                    senderEmail: 'system@sitecommand.internal',
                    message: `Request reopened by ${currentUser.name}`,
                    createdAt: new Date().toISOString(),
                };
                updates.messages = arrayUnion(reopeningMessage);
            }

            updateDoc(docRef, updates)
              .then(() => toast({ title: 'Success', description: `Request ${newStatus}.` }))
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: 'update',
                  requestResourceData: updates,
                });
                errorEmitter.emit('permission-error', permissionError);
              });
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
                                <span className="sr-only">{isClosing ? 'Close' : 'Reopen'} Request</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isClosing ? 'Close' : 'Reopen'} Request</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will {isClosing ? 'close' : 'reopen'} the information request. A status update will be added to the conversation.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUpdate} disabled={isPending}>
                        {isPending ? 'Updating...' : 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function DeleteRequestButton({ requestId }: { requestId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleDelete = () => {
        startTransition(async () => {
            const docRef = doc(db, 'information-requests', requestId);
            deleteDoc(docRef)
              .then(() => toast({ title: 'Success', description: 'Request deleted.' }))
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
              });
        });
    };

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Delete Request</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Delete Request</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete this information request. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function DeleteMessageButton({ requestId, message }: { requestId: string, message: ChatMessage }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleDelete = () => {
        startTransition(async () => {
            const docRef = doc(db, 'information-requests', requestId);
            const updates = {
                messages: arrayRemove(message)
            };
            updateDoc(docRef, updates)
              .then(() => toast({ title: 'Success', description: 'Message deleted.' }))
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: docRef.path,
                  operation: 'update',
                  requestResourceData: updates,
                });
                errorEmitter.emit('permission-error', permissionError);
              });
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <Trash2 className="h-3 w-3" />
                    <span className="sr-only">Delete Message</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove your message from the conversation history.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}


type InformationRequestCardProps = {
  item: InformationRequest;
  projects: Project[];
  distributionUsers: DistributionUser[];
  currentUser: DistributionUser;
};

export function InformationRequestCard({
  item,
  projects,
  distributionUsers,
  currentUser,
}: InformationRequestCardProps) {
  const project = projects.find((p) => p.id === item.projectId);

  const assignedToArray = useMemo(() => {
      return Array.isArray(item.assignedTo)
        ? item.assignedTo
        : item.assignedTo ? [item.assignedTo] : [];
  }, [item.assignedTo]);
    
  const sortedMessages = [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <CardTitle className="text-xl">{project?.name || 'Unknown Project'}</CardTitle>
            <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80 font-medium">
                    Opened on <ClientDate date={item.createdAt} format="date" />
                </span>
            </CardDescription>
            {item.requiredBy && (
                <div className="flex items-center gap-2 text-xs text-destructive mt-2 font-semibold">
                    <CalendarClock className="h-4 w-4" />
                    <span>Required by: <ClientDate date={item.requiredBy} format="date" /></span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className='capitalize'>{item.status}</Badge>
            {item.status === 'open' ? (
                <>
                    <RespondToRequest item={item} distributionUsers={distributionUsers} currentUser={currentUser} />
                    <UpdateStatusButton requestId={item.id} newStatus="closed" currentUser={currentUser} />
                </>
            ) : (
              <UpdateStatusButton requestId={item.id} newStatus="open" currentUser={currentUser} />
            )}
            <EditInformationRequest item={item} projects={projects} distributionUsers={distributionUsers} />
            <DeleteRequestButton requestId={item.id} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="bg-muted/30 p-4 rounded-lg border mb-6">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Original Request</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {assignedToArray.length > 0 && (
            <AccordionItem value="assigned-to">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    Assigned To ({assignedToArray.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {assignedToArray.map((email, index) => {
                    const user = distributionUsers.find(u => u.email === email);
                    const displayName = user ? `${user.name} (${user.email})` : email;
                    return <Badge key={index} variant="outline" className="bg-background">{displayName}</Badge>;
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          
          <AccordionItem value="conversation" className="border-none">
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareReply className="h-4 w-4" />
                <span>Conversation ({sortedMessages.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 px-1">
              {sortedMessages.length === 0 ? (
                  <div className="py-8 text-center bg-muted/20 rounded-lg border-2 border-dashed">
                    <p className="text-sm text-muted-foreground">No conversation items yet.</p>
                  </div>
              ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                    {sortedMessages.map((msg) => {
                        const isSystem = msg.senderEmail === 'system@sitecommand.internal';
                        const isMe = msg.senderEmail === currentUser.email.toLowerCase().trim();

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-4">
                                    <span className="bg-muted/50 text-[10px] uppercase font-bold px-3 py-1 rounded-full text-muted-foreground tracking-tighter">
                                        {msg.message}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={cn("flex flex-col group", isMe ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "relative px-4 py-2 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm",
                                    isMe 
                                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                                        : "bg-muted text-foreground rounded-tl-none border"
                                )}>
                                    {!isMe && (
                                        <p className="text-[10px] font-bold mb-1 text-primary tracking-wide">
                                            {msg.sender}
                                        </p>
                                    )}
                                    <p className="text-sm leading-snug whitespace-pre-wrap">{msg.message}</p>
                                    <div className={cn(
                                        "flex items-center justify-end gap-1 mt-1",
                                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )}>
                                        <span className="text-[9px] font-medium uppercase">
                                            <ClientDate date={msg.createdAt} />
                                        </span>
                                        {isMe && <DeleteMessageButton requestId={item.id} message={msg} />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                  </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {item.photos && item.photos.length > 0 && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  <span>Attached Photos ({item.photos.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Carousel className="w-full max-w-sm mx-auto">
                  <CarouselContent>
                    {item.photos.map((photo, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <div className="space-y-2">
                            <Image
                              src={photo.url}
                              alt="Context"
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                            />
                            <p className="text-xs text-muted-foreground text-center">
                              Taken on: <ClientDate date={photo.takenAt} />
                            </p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {item.photos.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
