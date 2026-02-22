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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addChatMessageAction } from './actions';
import { MessageSquareReply } from 'lucide-react';
import type { InformationRequest, DistributionUser } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const AddChatMessageSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1, 'Message cannot be empty.'),
  senderId: z.string().min(1, 'You must select who is sending the message.'),
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
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddChatMessageFormValues>({
    resolver: zodResolver(AddChatMessageSchema),
    defaultValues: {
      id: item.id,
      message: '',
      senderId: currentUser.id,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: item.id,
        message: '',
        senderId: currentUser.id,
      });
    }
  }, [open, item, form, currentUser.id]);

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('id', values.id);
      formData.append('message', values.message);
      formData.append('senderId', values.senderId);

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

  const messages = item.messages || [];

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
                {messages.map(msg => (
                    <div key={msg.id}>
                        <p className='text-sm font-semibold'>{msg.sender}:</p>
                        <p className='text-sm text-muted-foreground mt-1'>{msg.message}</p>
                    </div>
                ))}
            </div>
            <FormField
              control={form.control}
              name="senderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Replying As</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {distributionUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
