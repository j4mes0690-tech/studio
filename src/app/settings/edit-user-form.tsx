'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useEffect, useState } from 'react';
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
import { Pencil, Loader2, Save } from 'lucide-react';
import type { DistributionUser } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';

const EditUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
  canManageMaterials: z.boolean().default(false),
  hasFullVisibility: z.boolean().default(false),
});

type EditUserFormValues = z.infer<typeof EditUserSchema>;

type EditUserFormProps = {
  user: DistributionUser;
};

export function EditUserForm({ user }: EditUserFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(EditUserSchema),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password || '',
      canManageUsers: user.permissions?.canManageUsers || false,
      canManageSubcontractors: user.permissions?.canManageSubcontractors || false,
      canManageProjects: user.permissions?.canManageProjects || false,
      canManageChecklists: user.permissions?.canManageChecklists || false,
      canManageMaterials: user.permissions?.canManageMaterials || false,
      hasFullVisibility: user.permissions?.hasFullVisibility || false,
    },
  });
  
  useEffect(() => {
    if (open) {
      form.reset({
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password || '',
        canManageUsers: user.permissions?.canManageUsers || false,
        canManageSubcontractors: user.permissions?.canManageSubcontractors || false,
        canManageProjects: user.permissions?.canManageProjects || false,
        canManageChecklists: user.permissions?.canManageChecklists || false,
        canManageMaterials: user.permissions?.canManageMaterials || false,
        hasFullVisibility: user.permissions?.hasFullVisibility || false,
      });
    }
  }, [open, user, form]);

  const onSubmit = (values: EditUserFormValues) => {
    startTransition(async () => {
      const docId = user.id || user.email;
      const docRef = doc(db, 'users', docId);
      const updates = {
        name: values.name,
        password: values.password,
        permissions: {
          canManageUsers: values.canManageUsers,
          canManageSubcontractors: values.canManageSubcontractors,
          canManageProjects: values.canManageProjects,
          canManageChecklists: values.canManageChecklists,
          canManageMaterials: values.canManageMaterials,
          hasFullVisibility: values.hasFullVisibility,
        }
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'User profile updated.' });
          setOpen(false);
        })
        .catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit User Profile</DialogTitle>
          <DialogDescription>Update credentials and permissions for {user.name}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <input type="hidden" {...form.register('id')} />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Internal Login)</FormLabel>
                      <FormControl><Input {...field} readOnly /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Password</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <div className="space-y-4">
                    <FormLabel>Access & Visibility</FormLabel>
                    <FormField control={form.control} name="hasFullVisibility" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border-2 border-primary/20 p-3 bg-primary/5">
                            <div className="space-y-0.5"><FormLabel className="text-primary font-bold">Admin Visibility</FormLabel><FormDescription className="text-[10px]">Access to ALL projects.</FormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                    {[
                      { name: 'canManageUsers', label: 'Manage Users', desc: 'Internal staff control.' },
                      { name: 'canManageSubcontractors', label: 'Manage Partners', desc: 'Trade partner directory.' },
                      { name: 'canManageProjects', label: 'Manage Projects', desc: 'Site setup and assignments.' },
                      { name: 'canManageMaterials', label: 'Manage Procurement', desc: 'Suppliers and items.' },
                      { name: 'canManageChecklists', label: 'Manage Templates', desc: 'QC master lists.' },
                    ].map(perm => (
                      <FormField key={perm.name} control={form.control} name={perm.name as any} render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5"><FormLabel>{perm.label}</FormLabel><FormDescription className="text-[10px]">{perm.desc}</FormDescription></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    ))}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
