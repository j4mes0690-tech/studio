'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
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
import { FirestorePermissionError } from '@/firebase/errors';

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
        message: values.message,
        createdAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'information-requests', item.id);
      const updates = { 
          // Use arrayUnion to safely add to the messages array in Firestore
          messages: arrayUnion(newMessage) 
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Message sent.' });
          setOpen(false);
        })
        .catch((error) => {
          console.error("Error replying to request:", error);
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const messages = useMemo(() => {
    const rawMessages = item.messages || [];
    return [...rawMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [item.messages]);

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reply to Request</DialogTitle>
          <DialogDescription>
            Add a message to the conversation thread.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className='p-4 border rounded-md bg-muted/50 max-h-48 overflow-y-auto space-y-4'>
                <div>
                    <p className='text-sm font-semibold text-primary'>Original Request:</p>
                    <p className='text-sm text-muted-foreground mt-1'>{item.description}</p>
                </div>
                {messages.map(msg => (
                    <div key={msg.id} className="pt-2 border-t first:border-t-0">
                        <p className='text-xs font-semibold'>{msg.sender}:</p>
                        <p className='text-sm text-muted-foreground mt-1'>{msg.message}</p>
                    </div>
                ))}
            </div>
            
            <div className="text-sm font-medium">Replying As: {currentUser.name}</div>

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Message</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Type your message here..." className="min-h-[120px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}