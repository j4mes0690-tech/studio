'use client';

import { useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2, Send, Mail, ShieldCheck, Users2, Sparkles, AlertCircle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Project, DistributionUser, Invitation } from '@/lib/types';
import { sendInvitationEmailAction } from './actions';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const InviteSchema = z.object({
  email: z.string().email('Valid email required.'),
  name: z.string().min(1, 'Name is required.'),
  userType: z.enum(['internal', 'partner']),
  projectId: z.string().optional(),
});

type InviteFormValues = z.infer<typeof InviteSchema>;

export function InviteCollaboratorDialog({ projects, currentUser }: { projects: Project[], currentUser: DistributionUser }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(InviteSchema),
    defaultValues: { email: '', name: '', userType: 'partner', projectId: 'none' },
  });

  const selectedUserType = form.watch('userType');

  const onSubmit = (values: InviteFormValues) => {
    setErrorStatus(null);
    startTransition(async () => {
      try {
        const email = values.email.toLowerCase().trim();
        
        // Check if user already exists
        const userRef = doc(db, 'users', email);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          toast({ 
            title: 'User Already Registered', 
            description: `"${email}" already has an active system profile. You do not need to invite them again. You can manage their project access directly in System Settings.`,
            variant: 'destructive'
          });
          return;
        }

        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

        const inviteData: any = {
          email,
          name: values.name,
          userType: values.userType,
          token,
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          createdByEmail: currentUser.email,
        };

        if (values.projectId && values.projectId !== 'none') {
          inviteData.projectId = values.projectId;
        }

        const colRef = collection(db, 'invitations');
        await addDoc(colRef, inviteData);

        const host = typeof window !== 'undefined' ? window.location.origin : '';
        const inviteLink = `${host}/join?token=${token}`;

        const result = await sendInvitationEmailAction({
          email: inviteData.email,
          name: inviteData.name,
          inviteLink,
          inviterName: currentUser.name,
          userType: values.userType
        });

        if (result.success) {
          toast({ title: 'Invitation Sent', description: `An onboarding link has been emailed to ${values.email}.` });
          setOpen(false);
          form.reset();
        } else {
          setErrorStatus(result.message);
          toast({ 
            title: result.isConfigError ? 'Service Not Configured' : 'Delivery Failed', 
            description: result.message,
            variant: 'destructive' 
          });
        }
      } catch (err: any) {
        console.error(err);
        setErrorStatus(err.message || 'System error occurred.');
        toast({ title: 'System Error', description: 'Failed to generate invitation.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) setErrorStatus(null); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20">
          <UserPlus className="h-4 w-4" />
          Invite Collaborator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-primary/10 p-2 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Invite to SiteCommand</DialogTitle>
          </div>
          <DialogDescription>
            Send a secure onboarding link to a new staff member or trade partner.
          </DialogDescription>
        </DialogHeader>

        {errorStatus && (
            <Alert variant="destructive" className="my-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Onboarding Issues</AlertTitle>
                <AlertDescription className="text-xs">
                    {errorStatus}
                    <p className="mt-2 font-bold">The invitation has been logged in the system. You can copy the join link manually from the Invitations list below.</p>
                </AlertDescription>
            </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g. Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="jane@company.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="userType" render={({ field }) => (
                <FormItem>
                    <FormLabel>Collaboration Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="partner">
                                <div className="flex items-center gap-2">
                                    <Users2 className="h-4 w-4 text-accent" />
                                    <span>Trade Partner (Subcontractor)</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="internal">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <span>Internal Staff Member</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <FormDescription className="text-[10px]">
                        {selectedUserType === 'partner' 
                            ? 'Partners have restricted visibility, seeing only their assigned tasks and instructions.' 
                            : 'Staff members have broader access to project records and administrative tools.'}
                    </FormDescription>
                </FormItem>
            )} />

            <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                    <FormLabel>Auto-Assign to Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Optional: Select project" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="none">No initial assignment</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Secure Invitation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
