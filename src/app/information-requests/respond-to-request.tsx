
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
import { addResponseToInformationRequestAction } from './actions';
import { MessageSquareReply } from 'lucide-react';
import type { InformationRequest } from '@/lib/types';

const RespondToRequestSchema = z.object({
  id: z.string().min(1),
  response: z.string().min(1, 'Response cannot be empty.'),
});

type RespondToRequestFormValues = z.infer<typeof RespondToRequestSchema>;

type RespondToRequestProps = {
  item: InformationRequest;
};

export function RespondToRequest({ item }: RespondToRequestProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<RespondToRequestFormValues>({
    resolver: zodResolver(RespondToRequestSchema),
    defaultValues: {
      id: item.id,
      response: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: item.id,
        response: '',
      });
    }
  }, [open, item, form]);

  const onSubmit = (values: RespondToRequestFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('id', values.id);
      formData.append('response', values.response);

      const result = await addResponseToInformationRequestAction(formData);

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
        <Button variant="outline">
            <MessageSquareReply className="mr-2 h-4 w-4" />
            Respond
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respond to Information Request</DialogTitle>
          <DialogDescription>
            Provide a response to the client's request. This will mark the request as closed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <div className='p-4 border rounded-md bg-muted/50'>
                <p className='text-sm font-semibold'>Original Request:</p>
                <p className='text-sm text-muted-foreground mt-1'>{item.description}</p>
            </div>
            <FormField
              control={form.control}
              name="response"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Response</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your response here..."
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
                {isPending ? 'Submitting...' : 'Submit Response'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
