
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { updateUserAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Pencil } from 'lucide-react';
import type { DistributionUser } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

const EditUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().optional(),
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
});

type EditUserFormValues = z.infer<typeof EditUserSchema>;

type EditUserFormProps = {
  user: DistributionUser;
};

export function EditUserForm({ user }: EditUserFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(EditUserSchema),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      canManageUsers: user.permissions?.canManageUsers || false,
      canManageSubcontractors: user.permissions?.canManageSubcontractors || false,
      canManageProjects: user.permissions?.canManageProjects || false,
      canManageChecklists: user.permissions?.canManageChecklists || false,
    },
  });
  
  useEffect(() => {
    if (open) {
      form.reset({
        id: user.id,
        name: user.name,
        email: user.email,
        password: '',
        canManageUsers: user.permissions?.canManageUsers || false,
        canManageSubcontractors: user.permissions?.canManageSubcontractors || false,
        canManageProjects: user.permissions?.canManageProjects || false,
        canManageChecklists: user.permissions?.canManageChecklists || false,
      });
    }
  }, [open, user, form]);

  const onSubmit = (values: EditUserFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('id', values.id);
      formData.append('name', values.name);
      formData.append('email', values.email);
      if (values.password) {
        formData.append('password', values.password);
      }
      if (values.canManageUsers) formData.append('canManageUsers', 'on');
      if (values.canManageSubcontractors) formData.append('canManageSubcontractors', 'on');
      if (values.canManageProjects) formData.append('canManageProjects', 'on');
      if (values.canManageChecklists) formData.append('canManageChecklists', 'on');

      const result = await updateUserAction(formData);

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
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit User</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update the user's name, email address, password, and permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input {...field} />
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
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave blank to keep current password" {...field} />
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

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
