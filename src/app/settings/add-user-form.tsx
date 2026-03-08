
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
  // Administrative
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
  canManagePermitTemplates: z.boolean().default(false),
  canManageTraining: z.boolean().default(false),
  hasFullVisibility: z.boolean().default(false),
  // Module Access
  accessMaterials: z.boolean().default(true),
  accessPlant: z.boolean().default(true),
  accessVariations: z.boolean().default(true),
  accessPermits: z.boolean().default(true),
  accessTraining: z.boolean().default(true),
  accessClientInstructions: z.boolean().default(true),
  accessSiteInstructions: z.boolean().default(true),
  accessCleanupNotices: z.boolean().default(true),
  accessSnagging: z.boolean().default(true),
  accessQualityControl: z.boolean().default(true),
  accessInfoRequests: z.boolean().default(true),
  accessPaymentNotices: z.boolean().default(true),
  accessSubContractOrders: z.boolean().default(true),
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
      canManagePermitTemplates: false,
      canManageTraining: false,
      hasFullVisibility: false,
      accessMaterials: true,
      accessPlant: true,
      accessVariations: true,
      accessPermits: true,
      accessTraining: true,
      accessClientInstructions: true,
      accessSiteInstructions: true,
      accessCleanupNotices: true,
      accessSnagging: true,
      accessQualityControl: true,
      accessInfoRequests: true,
      accessPaymentNotices: true,
      accessSubContractOrders: true,
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
          canManagePermitTemplates: values.canManagePermitTemplates,
          canManageTraining: values.canManageTraining,
          hasFullVisibility: values.hasFullVisibility,
          accessMaterials: values.accessMaterials,
          accessPlant: values.accessPlant,
          accessVariations: values.accessVariations,
          accessPermits: values.accessPermits,
          accessTraining: values.accessTraining,
          accessClientInstructions: values.accessClientInstructions,
          accessSiteInstructions: values.accessSiteInstructions,
          accessCleanupNotices: values.accessCleanupNotices,
          accessSnagging: values.accessSnagging,
          accessQualityControl: values.accessQualityControl,
          accessInfoRequests: values.accessInfoRequests,
          accessPaymentNotices: values.accessPaymentNotices,
          accessSubContractOrders: values.accessSubContractOrders,
        }
      };

      const docRef = doc(db, 'users', email);
      
      setDoc(docRef, profile)
        .then(() => {
          toast({ title: 'Success', description: 'User profile created.' });
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
        className="space-y-6"
      >
        <div className="space-y-4">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Full Name</FormLabel>
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
                <FormLabel>Initial Password</FormLabel>
                <FormControl>
                    <Input type="password" placeholder="System password" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Administrative Permissions</FormLabel>
                <div className="space-y-3">
                    <FormField
                        control={form.control}
                        name="hasFullVisibility"
                        render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border-2 border-primary/20 p-3 shadow-sm bg-primary/5">
                            <div className="space-y-0.5">
                                <FormLabel className="text-primary font-bold">Admin Visibility</FormLabel>
                                <FormDescription className="text-[10px]">Access to ALL projects and data.</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                        )}
                    />
                    
                    {[
                        { name: 'canManageUsers', label: 'Manage Users', desc: 'Internal staff and passwords.' },
                        { name: 'canManageSubcontractors', label: 'Manage Partners', desc: 'Manage sub-contractors, designers, and suppliers.' },
                        { name: 'canManageProjects', label: 'Manage Projects', desc: 'Site setup and assignments.' },
                        { name: 'canManageChecklists', label: 'Manage QC Templates', desc: 'Master checklist definitions.' },
                        { name: 'canManagePermitTemplates', label: 'Manage Permit Forms', desc: 'Master permit-to-work setup.' },
                        { name: 'canManageTraining', label: 'Manage Training', desc: 'Staff compliance oversight.' },
                    ].map(perm => (
                        <FormField
                            key={perm.name}
                            control={form.control}
                            name={perm.name as any}
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-xs font-semibold">{perm.label}</FormLabel>
                                    <FormDescription className="text-[10px]">{perm.desc}</FormDescription>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <FormLabel className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Module Access</FormLabel>
                <div className="space-y-3">
                    {[
                        { name: 'accessMaterials', label: 'Materials Orders' },
                        { name: 'accessPlant', label: 'Plant Hire' },
                        { name: 'accessSubContractOrders', label: 'Sub Contract Orders' },
                        { name: 'accessVariations', label: 'Variation Pricing' },
                        { name: 'accessPermits', label: 'Permits to Work' },
                        { name: 'accessTraining', label: 'Training & Compliance' },
                        { name: 'accessClientInstructions', label: 'Client Instructions' },
                        { name: 'accessSiteInstructions', label: 'Site Instructions' },
                        { name: 'accessCleanupNotices', label: 'Clean Up Notices' },
                        { name: 'accessSnagging', label: 'Snagging Lists' },
                        { name: 'accessQualityControl', label: 'Quality Control' },
                        { name: 'accessInfoRequests', label: 'Information Requests' },
                        { name: 'accessPaymentNotices', label: 'Payment Notices' },
                    ].map(mod => (
                        <FormField
                            key={mod.name}
                            control={form.control}
                            name={mod.name as any}
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                                <span className="text-xs font-semibold">{mod.label}</span>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add User Profile'}
        </Button>
      </form>
    </Form>
  );
}
