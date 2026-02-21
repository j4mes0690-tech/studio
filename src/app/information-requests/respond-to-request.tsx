
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
import { addChatMessageAction } from './actions';
import { MessageSquareReply } from 'lucide-react';
import type { InformationRequest } from '@/lib/types';

const AddChatMessageSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1, 'Message cannot be empty.'),
});

type AddChatMessageFormValues = z.infer<typeof AddChatMessageSchema>;

type RespondToRequestProps = {
  item: InformationRequest;
};

export function RespondToRequest({ item }: RespondToRequestProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddChatMessageFormValues>({
    resolver: zodResolver(AddChatMessageSchema),
    defaultValues: {
      id: item.id,
      message: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: item.id,
        message: '',
      });
    }
  }, [open, item, form]);

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('id', values.id);
      formData.append('message', values.message);

      const result = await addChatMessageAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        setOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
            <MessageSquareReply className="mr-2 h-4 w-4" />
            Reply
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to conversation</DialogTitle>
          <DialogDescription>
            Add a message to the conversation thread for this request.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <div className='p-4 border rounded-md bg-muted/50 max-h-48 overflow-y-auto space-y-4'>
                <div>
                    <p className='text-sm font-semibold'>Original Request:</p>
                    <p className='text-sm text-muted-foreground mt-1'>{item.description}</p>
                </div>
                {item.messages.map(msg => (
                    <div key={msg.id}>
                        <p className='text-sm font-semibold'>{msg.sender}:</p>
                        <p className='text-sm text-muted-foreground mt-1'>{msg.message}</p>
                    </div>
                ))}
            </div>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your message here..."
                      className="min-h-[150px]"
                      {...field}
                    />
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
