
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
import { addUserAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const AddUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
});

type AddUserFormValues = z.infer<typeof AddUserSchema>;

export function AddUserForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(AddUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      canManageUsers: false,
      canManageSubcontractors: false,
      canManageProjects: false,
      canManageChecklists: false,
    },
  });

  const onSubmit = (values: AddUserFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('email', values.email);
      formData.append('password', values.password);
      if (values.canManageUsers) formData.append('canManageUsers', 'on');
      if (values.canManageSubcontractors) formData.append('canManageSubcontractors', 'on');
      if (values.canManageProjects) formData.append('canManageProjects', 'on');
      if (values.canManageChecklists) formData.append('canManageChecklists', 'on');

      const result = await addUserAction(formData);

      if (result.success) {
        toast({ title: 'Success', description: result.message });
        form.reset();
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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="space-y-4">
          <FormLabel>Admin Permissions</FormLabel>
            <FormField
                control={form.control}
                name="canManageUsers"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Manage Users</FormLabel>
                        <FormDescription>
                            Can add, edit, and remove users.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="canManageSubcontractors"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Manage Sub-contractors</FormLabel>
                        <FormDescription>
                            Can add, edit, and remove sub-contractors.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="canManageProjects"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Manage Projects</FormLabel>
                        <FormDescription>
                           Can add, edit, and remove projects and their areas.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="canManageChecklists"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Manage Checklist Templates</FormLabel>
                        <FormDescription>
                            Can create, edit, and delete checklist templates.
                        </FormDescription>
                    </div>
                    <FormControl>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                    </FormControl>
                </FormItem>
                )}
            />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add User'}
        </Button>
      </form>
    </Form>
  );
}
