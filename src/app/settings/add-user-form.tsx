
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
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
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const AddUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
  hasFullVisibility: z.boolean().default(false),
});

type AddUserFormValues = z.infer<typeof AddUserSchema>;

export function AddUserForm() {
  const { toast } = useToast();
  const db = useFirestore();
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
      hasFullVisibility: false,
    },
  });

  const onSubmit = (values: AddUserFormValues) => {
    startTransition(async () => {
      const email = values.email.toLowerCase().trim();
      const profile = {
        id: email,
        name: values.name,
        email: email,
        password: values.password,
        permissions: {
          canManageUsers: values.canManageUsers,
          canManageSubcontractors: values.canManageSubcontractors,
          canManageProjects: values.canManageProjects,
          canManageChecklists: values.canManageChecklists,
          hasFullVisibility: values.hasFullVisibility,
        }
      };

      const docRef = doc(db, 'users', email);
      
      setDoc(docRef, profile)
        .then(() => {
          toast({ title: 'Success', description: 'User profile and credentials created.' });
          form.reset();
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: profile,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
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
                <Input type="password" placeholder="System password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <div className="space-y-4">
          <FormLabel>Access & Visibility</FormLabel>
            <FormField
                control={form.control}
                name="hasFullVisibility"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border-2 border-primary/20 p-3 shadow-sm bg-primary/5">
                    <div className="space-y-0.5">
                        <FormLabel className="text-primary font-bold">Administrative Visibility</FormLabel>
                        <FormDescription>
                            Enable to allow this user to see ALL projects and records.
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
                name="canManageUsers"
                render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <FormLabel>Manage Users</FormLabel>
                        <FormDescription>
                            Can add, edit, and remove users and credentials.
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
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add User Profile'}
        </Button>
      </form>
    </Form>
  );
}
