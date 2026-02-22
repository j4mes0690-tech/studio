'use client';

import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquareReply } from 'lucide-react';
import type { InformationRequest, DistributionUser, ChatMessage } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ClientDate } from '../../components/client-date';
import { Badge } from '@/components/ui/badge';

const AddChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

type AddChatMessageFormValues = z.infer<typeof AddChatMessageSchema>;

type RespondToRequestProps = {
  item: InformationRequest;
  distributionUsers: DistributionUser[];
  currentUser: DistributionUser;
};

export function RespondToRequest({ item, distributionUsers, currentUser }: RespondToRequestProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddChatMessageFormValues>({
    resolver: zodResolver(AddChatMessageSchema),
    defaultValues: {
      message: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ message: '' });
    }
  }, [open, form]);

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: currentUser.name,
        senderEmail: currentUser.email.toLowerCase().trim(),
        message: values.message,
        createdAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'information-requests', item.id);
      const updates = { 
          messages: arrayUnion(newMessage),
          dismissedBy: []
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Message sent.' });
          setOpen(false);
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  // Sort messages directly during render to ensure reactivity from parent state
  const sortedMessages = [...(item.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                  <MessageSquareReply className="h-4 w-4" />
                  <span className="sr-only">Reply to Request</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reply to Request</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reply to Request</DialogTitle>
          <DialogDescription>
            Post a message to the conversation thread.
          </DialogDescription>
        </DialogHeader>
        
        <div className='flex-1 overflow-y-auto min-h-0 py-4 px-2 space-y-4 bg-muted/10 rounded-md border'>
            <div className='bg-background p-3 rounded-lg border-l-4 border-l-primary shadow-sm mb-6'>
                <p className='text-[10px] font-bold text-primary uppercase tracking-widest mb-1'>Original Issue</p>
                <p className='text-sm text-foreground line-clamp-3'>{item.description}</p>
            </div>

            {sortedMessages.length === 0 ? (
                <p className='text-center text-xs text-muted-foreground py-4 italic'>No messages yet. Be the first to respond.</p>
            ) : (
                <div className='space-y-3'>
                    {sortedMessages.map(msg => {
                        const senderEmail = msg.senderEmail || '';
                        const isSystem = senderEmail === 'system@sitecommand.internal';
                        const normalizedCurrentEmail = (currentUser.email || '').toLowerCase().trim();
                        const normalizedSenderEmail = senderEmail.toLowerCase().trim();
                        const isMe = !isSystem && normalizedSenderEmail === normalizedCurrentEmail;

                        if (isSystem) {
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <span className="bg-muted/50 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full text-muted-foreground border">
                                        {msg.message}
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "px-3 py-1.5 rounded-2xl max-w-[90%] shadow-sm",
                                    isMe 
                                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                                        : "bg-muted text-foreground rounded-tl-none border"
                                )}>
                                    {!isMe && <p className="text-[9px] font-bold mb-0.5 text-primary">{msg.sender}</p>}
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                    <div className={cn("text-[8px] text-right mt-0.5 opacity-70")}>
                                        <ClientDate date={msg.createdAt} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-2">
                <span>Replying as:</span>
                <Badge variant="secondary" className="text-[10px] px-2 py-0 h-auto">{currentUser.name}</Badge>
            </div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea 
                        placeholder="Type your message here..." 
                        className="min-h-[100px] resize-none" 
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
