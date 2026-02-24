
'use client';

import type { ClientInstruction, Project, DistributionUser, ChatMessage } from '@/lib/types';
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
import { CheckSquare, MessageCircle, Camera, Users, Trash2, MessageSquareReply, CheckCircle2, FileText, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '../../components/client-date';
import { useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
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
import { Button } from '@/components/ui/button';
import { RespondToInstruction } from './respond-to-instruction';
import { cn } from '@/lib/utils';

function DeleteMessageButton({ instructionId, message }: { instructionId: string, message: ChatMessage }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleDelete = () => {
        startTransition(async () => {
            const docRef = doc(db, 'client-instructions', instructionId);
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
                        This will permanently remove your update from the conversation history.
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

function AcceptInstructionButton({ instruction, currentUser }: { instruction: ClientInstruction, currentUser: DistributionUser }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const db = useFirestore();

    const handleAccept = () => {
        startTransition(async () => {
            const docRef = doc(db, 'client-instructions', instruction.id);
            const systemMessage: ChatMessage = {
                id: `system-${Date.now()}`,
                sender: 'System',
                senderEmail: 'system@sitecommand.internal',
                message: `Instruction ACCEPTED by ${currentUser.name}. Ready for implementation.`,
                createdAt: new Date().toISOString()
            };

            const updates = {
                status: 'accepted',
                messages: arrayUnion(systemMessage)
            };

            updateDoc(docRef, updates)
              .then(() => {
                  toast({ title: 'Instruction Accepted', description: 'The directive has been marked for implementation.' });
              })
              .catch((err) => {
                  const permissionError = new FirestorePermissionError({
                      path: docRef.path,
                      operation: 'update',
                      requestResourceData: updates
                  });
                  errorEmitter.emit('permission-error', permissionError);
              });
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-green-600 border-green-200 hover:bg-green-50">
                    <CheckCircle2 className="h-4 w-4" />
                    Accept Instruction
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Accept this Instruction?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirming will mark this directive as "Accepted". This indicates that you have all required information and are ready to proceed with implementation.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAccept} disabled={isPending} className="bg-green-600 hover:bg-green-700">
                        {isPending ? 'Processing...' : 'Confirm Acceptance'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

type InstructionCardProps = {
  instruction: ClientInstruction;
  projects: Project[];
  currentUser: DistributionUser;
};

export function ClientInstructionCard({
  instruction,
  projects,
  currentUser,
}: InstructionCardProps) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'client-instructions', instruction.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Client instruction deleted.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const isAccepted = instruction.status === 'accepted';
  const sortedMessages = [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Card className={cn("border-l-4", isAccepted ? "border-l-green-500 bg-green-50/10" : "border-l-primary")}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{project?.name || 'Unknown Project'}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground/80">
                <ClientDate date={instruction.createdAt} />
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isAccepted ? "secondary" : "default"} className={cn(isAccepted && "bg-green-100 text-green-800 border-green-200")}>
                {isAccepted ? "Accepted Directive" : "Open Directive"}
            </Badge>
            
            {!isAccepted && <AcceptInstructionButton instruction={instruction} currentUser={currentUser} />}
            <RespondToInstruction instruction={instruction} currentUser={currentUser} />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete Instruction</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Client Instruction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this record. This action cannot be undone.
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
      <CardContent>
        <p className="text-sm font-medium text-foreground mb-4">{instruction.summary}</p>
        
        <div className="space-y-4">
            {/* Unified Conversation Thread */}
            <div className="bg-muted/20 rounded-lg border p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2 mb-2">
                    <MessageCircle className="h-3 w-3" />
                    <span>Instruction Log & Thread</span>
                </div>

                {/* The "Original Entry" acts as the start of the thread */}
                <div className="flex flex-col items-start">
                    <div className="bg-background px-4 py-3 rounded-2xl rounded-tl-none border shadow-sm max-w-[90%]">
                        <p className="text-[10px] font-bold mb-1 text-primary uppercase">Initial Client Directive</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{instruction.originalText}</p>
                        
                        {/* Photos from original instruction */}
                        {instruction.photos && instruction.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            {instruction.photos.map((p, i) => (
                              <div key={i} className="relative aspect-video rounded overflow-hidden border">
                                <Image src={p.url} alt="Directive" fill className="object-cover" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Files from original instruction */}
                        {instruction.files && instruction.files.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {instruction.files.map((f, i) => (
                              <a key={i} href={f.url} download={f.name} className="flex items-center gap-1.5 p-1.5 rounded text-[10px] bg-muted border border-border text-primary hover:bg-accent transition-colors">
                                <FileText className="h-3 w-3" />
                                <span className="truncate flex-1">{f.name}</span>
                                <Download className="h-3 w-3" />
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="text-[9px] text-muted-foreground mt-2 uppercase font-medium">
                            Logged <ClientDate date={instruction.createdAt} />
                        </div>
                    </div>
                </div>

                {/* Follow-up messages */}
                <div className="space-y-4">
                    {sortedMessages.map((msg) => {
                        const normalizedCurrentEmail = (currentUser.email || '').toLowerCase().trim();
                        const normalizedSenderEmail = (msg.senderEmail || '').toLowerCase().trim();
                        const isMe = normalizedSenderEmail === normalizedCurrentEmail;
                        const isSystem = msg.senderEmail === 'system@sitecommand.internal';

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <Badge variant="outline" className="bg-background text-[10px] py-0.5 px-3 rounded-full border-dashed font-semibold text-muted-foreground">
                                        {msg.message}
                                    </Badge>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={cn("flex flex-col group", isMe ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "relative px-4 py-2 rounded-2xl max-w-[85%] shadow-sm",
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
                                    
                                    {/* Message Attachments */}
                                    {msg.photos && msg.photos.length > 0 && (
                                      <div className="grid grid-cols-2 gap-1 mt-2">
                                        {msg.photos.map((p, i) => (
                                          <div key={i} className="relative aspect-video rounded overflow-hidden border bg-background">
                                            <Image src={p.url} alt="Update" fill className="object-cover" />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {msg.files && msg.files.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {msg.files.map((f, i) => (
                                          <a key={i} href={f.url} download={f.name} className={cn("flex items-center gap-1.5 p-1.5 rounded text-[10px] border transition-colors", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white hover:bg-primary-foreground/20" : "bg-background border-border text-primary hover:bg-muted")}>
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate flex-1">{f.name}</span>
                                            <Download className="h-3 w-3" />
                                          </a>
                                        ))}
                                      </div>
                                    )}

                                    <div className={cn(
                                        "flex items-center justify-end gap-1 mt-1",
                                        isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                    )}>
                                        <span className="text-[9px] font-medium uppercase">
                                            <ClientDate date={msg.createdAt} />
                                        </span>
                                        {isMe && <DeleteMessageButton instructionId={instruction.id} message={msg} />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="action-items">
                <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    <span>
                    Extracted Action Items ({instruction.actionItems.length})
                    </span>
                </div>
                </AccordionTrigger>
                <AccordionContent>
                <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                    {instruction.actionItems.map((item, index) => (
                    <li key={index}>{item}</li>
                    ))}
                </ul>
                </AccordionContent>
            </AccordionItem>

            {instruction.recipients && instruction.recipients.length > 0 && (
                <AccordionItem value="recipients">
                <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                    Internal Distribution ({instruction.recipients.length})
                    </span>
                </div>
                </AccordionTrigger>
                <AccordionContent>
                <div className="flex flex-wrap gap-1">
                    {instruction.recipients.map((email, index) => (
                    <Badge key={index} variant="outline">{email}</Badge>
                    ))}
                </div>
                </AccordionContent>
            </AccordionItem>
            )}
            </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
