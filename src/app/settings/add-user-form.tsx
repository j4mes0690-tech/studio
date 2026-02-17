
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActionState, useEffect, useRef } from 'react';
import { addUserAction, type AddUserFormState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const AddUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
});

type AddUserFormValues = z.infer<typeof AddUserSchema>;

export function AddUserForm() {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(AddUserSchema),
    defaultValues: { name: '', email: '' },
  });

  const [formState, formAction] = useActionState<AddUserFormState, FormData>(
    addUserAction,
    { success: false, message: '' }
  );

  useEffect(() => {
    if (formState.message) {
      if (formState.success) {
        toast({ title: 'Success', description: formState.message });
        form.reset();
      } else {
        toast({
          title: 'Error',
          description: formState.message,
          variant: 'destructive',
        });
      }
    }
  }, [formState, toast, form]);

  return (
    <Form {...form}>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={form.handleSubmit(() => formRef.current?.submit())}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john.doe@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Adding...' : 'Add User'}
        </Button>
      </form>
    </Form>
  );
}
