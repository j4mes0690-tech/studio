'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Edit3, Loader2, Save, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubContractor } from '@/lib/types';

const AddUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  userType: z.enum(['internal', 'partner']).default('internal'),
  subContractorId: z.string().optional(),
  canManageUsers: z.boolean().default(false),
  canManageSubcontractors: z.boolean().default(false),
  canManageProjects: z.boolean().default(false),
  canManageChecklists: z.boolean().default(false),
  canManagePermitTemplates: z.boolean().default(false),
  canManageTraining: z.boolean().default(false),
  canManageIRS: z.boolean().default(false),
  canManageBranding: z.boolean().default(false),
  hasFullVisibility: z.boolean().default(false),
  
  accessMaterials: z.boolean().default(true),
  materialsReadOnly: z.boolean().default(false),
  
  accessPlant: z.boolean().default(true),
  plantReadOnly: z.boolean().default(false),
  
  accessSubContractOrders: z.boolean().default(true),
  subContractOrdersReadOnly: z.boolean().default(false),
  
  accessVariations: z.boolean().default(true),
  variationsReadOnly: z.boolean().default(false),
  
  accessPaymentNotices: z.boolean().default(true),
  paymentNoticesReadOnly: z.boolean().default(false),
  
  accessPermits: z.boolean().default(true),
  permitsReadOnly: z.boolean().default(false),
  
  accessTraining: z.boolean().default(true),
  trainingReadOnly: z.boolean().default(false),
  
  accessClientInstructions: z.boolean().default(true),
  clientInstructionsReadOnly: z.boolean().default(false),
  
  accessSiteInstructions: z.boolean().default(true),
  siteInstructionsReadOnly: z.boolean().default(false),
  
  accessCleanupNotices: z.boolean().default(true),
  cleanupNoticesReadOnly: z.boolean().default(false),
  
  accessSnagging: z.boolean().default(true),
  snaggingReadOnly: z.boolean().default(false),
  
  accessQualityControl: z.boolean().default(true),
  qualityControlReadOnly: z.boolean().default(false),
  
  accessInfoRequests: z.boolean().default(true),
  infoRequestsReadOnly: z.boolean().default(false),
  
  accessIRS: z.boolean().default(true),
  irsReadOnly: z.boolean().default(false),

  accessPlanner: z.boolean().default(true),
  plannerReadOnly: z.boolean().default(false),

  accessProcurement: z.boolean().default(true),
  procurementReadOnly: z.boolean().default(false),
});

type AddUserFormValues = z.infer<typeof AddUserSchema>;

export function AddUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: subContractors } = useCollection<SubContractor>(subsQuery);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(AddUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      userType: 'internal',
      subContractorId: 'none',
      canManageUsers: false,
      canManageSubcontractors: false,
      canManageProjects: false,
      canManageChecklists: false,
      canManagePermitTemplates: false,
      canManageTraining: false,
      canManageIRS: false,
      canManageBranding: false,
      hasFullVisibility: false,
      accessMaterials: true,
      materialsReadOnly: false,
      accessPlant: true,
      plantReadOnly: false,
      accessVariations: true,
      variationsReadOnly: false,
      accessPermits: true,
      permitsReadOnly: false,
      accessTraining: true,
      trainingReadOnly: false,
      accessClientInstructions: true,
      clientInstructionsReadOnly: false,
      accessSiteInstructions: true,
      siteInstructionsReadOnly: false,
      accessCleanupNotices: true,
      cleanupNoticesReadOnly: false,
      accessSnagging: true,
      snaggingReadOnly: false,
      accessQualityControl: true,
      qualityControlReadOnly: false,
      accessInfoRequests: true,
      infoRequestsReadOnly: false,
      accessPaymentNotices: true,
      paymentNoticesReadOnly: false,
      accessSubContractOrders: true,
      subContractOrdersReadOnly: false,
      accessIRS: true,
      irsReadOnly: false,
      accessPlanner: true,
      plannerReadOnly: false,
      accessProcurement: true,
      procurementReadOnly: false,
    },
  });

  const selectedUserType = form.watch('userType');

  const onSubmit = (values: AddUserFormValues) => {
    startTransition(async () => {
      const email = values.email.toLowerCase().trim();
      const profile = {
        id: email,
        name: values.name,
        email: email,
        password: values.password,
        userType: values.userType,
        subContractorId: values.subContractorId !== 'none' ? values.subContractorId : null,
        permissions: {
          canManageUsers: values.canManageUsers,
          canManageSubcontractors: values.canManageSubcontractors,
          canManageProjects: values.canManageProjects,
          canManageChecklists: values.canManageChecklists,
          canManagePermitTemplates: values.canManagePermitTemplates,
          canManageTraining: values.canManageTraining,
          canManageIRS: values.canManageIRS,
          canManageBranding: values.canManageBranding,
          hasFullVisibility: values.hasFullVisibility,
          
          accessMaterials: values.accessMaterials,
          materialsReadOnly: values.materialsReadOnly,
          
          accessPlant: values.accessPlant,
          plantReadOnly: values.plantReadOnly,
          
          accessSubContractOrders: values.accessSubContractOrders,
          subContractOrdersReadOnly: values.subContractOrdersReadOnly,
          
          accessVariations: values.accessVariations,
          variationsReadOnly: values.variationsReadOnly,
          
          accessPaymentNotices: values.accessPaymentNotices,
          paymentNoticesReadOnly: values.paymentNoticesReadOnly,
          
          accessPermits: values.accessPermits,
          permitsReadOnly: values.permitsReadOnly,
          
          accessTraining: values.accessTraining,
          trainingReadOnly: values.trainingReadOnly,
          
          accessClientInstructions: values.accessClientInstructions,
          clientInstructionsReadOnly: values.clientInstructionsReadOnly,
          
          accessSiteInstructions: values.accessSiteInstructions,
          siteInstructionsReadOnly: values.siteInstructionsReadOnly,
          
          accessCleanupNotices: values.accessCleanupNotices,
          cleanupNoticesReadOnly: values.cleanupNoticesReadOnly,
          
          accessSnagging: values.accessSnagging,
          snaggingReadOnly: values.snaggingReadOnly,
          
          accessQualityControl: values.accessQualityControl,
          qualityControlReadOnly: values.qualityControlReadOnly,
          
          accessInfoRequests: values.accessInfoRequests,
          infoRequestsReadOnly: values.infoRequestsReadOnly,
          
          accessIRS: values.accessIRS,
          irsReadOnly: values.irsReadOnly,

          accessPlanner: values.accessPlanner,
          plannerReadOnly: values.plannerReadOnly,

          accessProcurement: values.accessProcurement,
          procurementReadOnly: values.procurementReadOnly,
        }
      };

      const docRef = doc(db, 'users', email);
      
      setDoc(docRef, profile)
        .then(() => {
          toast({ title: 'Success', description: 'User profile created.' });
          form.reset();
          if (onSuccess) onSuccess();
        })
        .catch(async (error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: profile,
          } satisfies SecurityRuleContext));
        });
    });
  };

  const modules = [
    { access: 'accessPlanner', ro: 'plannerReadOnly', label: 'Planner' },
    { access: 'accessProcurement', ro: 'procurementReadOnly', label: 'Procurement' },
    { access: 'accessIRS', ro: 'irsReadOnly', label: 'IRS Schedule' },
    { access: 'accessMaterials', ro: 'materialsReadOnly', label: 'Materials' },
    { access: 'accessPlant', ro: 'plantReadOnly', label: 'Plant Hire' },
    { access: 'accessSubContractOrders', ro: 'subContractOrdersReadOnly', label: 'Sub Contract Orders' },
    { access: 'accessVariations', ro: 'variationsReadOnly', label: 'Variations' },
    { access: 'accessPaymentNotices', ro: 'paymentNoticesReadOnly', label: 'Payment Notices' },
    { access: 'accessPermits', ro: 'permitsReadOnly', label: 'Permits' },
    { access: 'accessTraining', ro: 'trainingReadOnly', label: 'Training' },
    { access: 'accessClientInstructions', ro: 'clientInstructionsReadOnly', label: 'Client Inst' },
    { access: 'accessSiteInstructions', ro: 'siteInstructionsReadOnly', label: 'Site Inst' },
    { access: 'accessCleanupNotices', ro: 'cleanupNoticesReadOnly', label: 'Cleanup Notices' },
    { access: 'accessSnagging', ro: 'snaggingReadOnly', label: 'Snagging' },
    { access: 'accessQualityControl', ro: 'qualityControlReadOnly', label: 'Quality Control' },
    { access: 'accessInfoRequests', ro: 'infoRequestsReadOnly', label: 'Info Requests' },
  ];

  const adminRights = [
    { name: 'canManageBranding', label: 'Company Branding', desc: 'Manage company logo and address.' },
    { name: 'canManageUsers', label: 'Manage Users', desc: 'Control user access and permissions.' },
    { name: 'canManageSubcontractors', label: 'Manage Partners', desc: 'Registry of external collaborators.' },
    { name: 'canManageProjects', label: 'Manage Projects', desc: 'Project configuration and teams.' },
    { name: 'canManageChecklists', label: 'Manage QC Templates', desc: 'Global quality standard setup.' },
    { name: 'canManagePermitTemplates', label: 'Manage Permit Templates', desc: 'High-risk permit form logic.' },
    { name: 'canManageTraining', label: 'Manage Training Needs', desc: 'Identify staff training gaps.' },
    { name: 'canManageIRS', label: 'Manage Master IRS', desc: 'Global schedule tracking.' },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Initial Password</FormLabel><FormControl><Input type="password" placeholder="System password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="userType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="internal">Internal Staff</SelectItem>
                                    <SelectItem value="partner">External Partner</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>

                {selectedUserType === 'partner' && (
                    <FormField control={form.control} name="subContractorId" render={({ field }) => (
                        <FormItem className="animate-in fade-in slide-in-from-top-2">
                            <FormLabel className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Company Association</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select partner company" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Independent / Freelance</SelectItem>
                                    {subContractors?.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription className="text-[10px]">Users associated with a company automatically see records linked to that partner.</FormDescription>
                        </FormItem>
                    )} />
                )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Admin Access Rights</FormLabel>
                    <div className="space-y-3">
                        <FormField control={form.control} name="hasFullVisibility" render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border-2 border-primary/20 p-3 bg-primary/5">
                                <div className="space-y-0.5"><FormLabel className="text-primary font-bold">Admin Visibility</FormLabel><FormDescription className="text-[10px]">Full access to all project data.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )} />
                        {adminRights.map(perm => (
                            <FormField key={perm.name} control={form.control} name={perm.name as any} render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-background">
                                <div className="space-y-0.5"><FormLabel className="text-xs font-semibold">{perm.label}</FormLabel><FormDescription className="text-[10px]">{perm.desc}</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                            )} />
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Module Specific Access</FormLabel>
                    <div className="space-y-3">
                        {modules.map(mod => (
                            <div key={mod.access} className="flex flex-col p-3 rounded-lg border bg-background gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold">{mod.label}</span>
                                    <FormField
                                        control={form.control}
                                        name={mod.access as any}
                                        render={({ field }) => (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold uppercase text-muted-foreground">Enabled</span>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </div>
                                        )}
                                    />
                                </div>
                                {form.watch(mod.access as any) && (
                                    <div className={cn(
                                        "flex items-center justify-between border-t pt-2 transition-all",
                                        form.watch(mod.ro as any) ? "bg-muted/30 -mx-3 -mb-3 p-3 rounded-b-lg border-t-0" : ""
                                    )}>
                                        <div className="flex items-center gap-2">
                                            {form.watch(mod.ro as any) ? (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black px-1.5 h-5 gap-1">
                                                    <Eye className="h-2.5 w-2.5" /> READ ONLY
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[9px] font-black px-1.5 h-5 gap-1">
                                                    <Edit3 className="h-2.5 w-2.5" /> READ / WRITE
                                                </Badge>
                                            )}
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name={mod.ro as any}
                                            render={({ field }) => (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Restrict</span>
                                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                </div>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/5 shrink-0">
          <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
            Create User Profile
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
