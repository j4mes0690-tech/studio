'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MessageSquareReply, Loader2, Send } from 'lucide-react';
import type { Instruction, DistributionUser, ChatMessage } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { VoiceInput } from '@/components/voice-input';

const RespondSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

export function RespondToInstruction({ instruction, currentUser }: { instruction: Instruction, currentUser: DistributionUser }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(RespondSchema),
    defaultValues: { message: '' },
  });

  const onSubmit = (values: { message: string }) => {
    startTransition(async () => {
      try {
        const newMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: currentUser.name || 'Site Manager',
          senderEmail: currentUser.email,
          message: values.message,
          createdAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'instructions', instruction.id), {
          messages: arrayUnion(newMessage)
        });

        toast({ title: 'Update Posted', description: 'The implementation thread has been updated.' });
        setOpen(false);
        form.reset();
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to post message.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <MessageSquareReply className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post Implementation Update</DialogTitle>
          <DialogDescription>Add a note to the audit trail for this instruction.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Update Details</span>
                    <VoiceInput onResult={field.onChange} />
                  </div>
                  <FormControl>
                    <Textarea placeholder="Progress update or query..." className="min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Post Message
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
