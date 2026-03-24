'use client';

import { useState, useEffect, useTransition, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, setDoc, arrayUnion, getDoc } from 'firebase/firestore';
import type { Invitation, DistributionUser, Project, UserPermissions } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ShieldCheck, Users2, KeyRound, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch invitation details
  const invitesQuery = useMemoFirebase(() => {
    if (!db || !token) return null;
    return query(collection(db, 'invitations'), where('token', '==', token), where('status', '==', 'pending'));
  }, [db, token]);
  
  const { data: invitations, isLoading: inviteLoading } = useCollection<Invitation>(invitesQuery);
  const invitation = invitations?.[0];

  useEffect(() => {
    if (!inviteLoading && !invitation && token) {
        toast({ title: 'Invalid Link', description: 'This invitation has expired or already been used.', variant: 'destructive' });
    }
  }, [inviteLoading, invitation, token, toast]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !db) return;

    if (password !== confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const email = invitation.email.toLowerCase().trim();
        const docRef = doc(db, 'users', email);

        // Safety check: Don't overwrite if user somehow already exists
        const userSnap = await getDoc(docRef);
        if (userSnap.exists()) {
            toast({ 
                title: 'Account Already Active', 
                description: 'A system profile already exists for this email. Please log in directly.',
                variant: 'destructive'
            });
            router.push('/login');
            return;
        }

        // 1. Create robust default permissions object
        const permissions: UserPermissions = {
            canManageUsers: false,
            canManageSubcontractors: false,
            canManageProjects: false,
            canManageChecklists: false,
            canManageMaterials: false,
            canManagePermitTemplates: false,
            canManageTraining: false,
            canManageIRS: false,
            canManageBranding: false,
            hasFullVisibility: false,
            accessMaterials: invitation.userType === 'internal',
            accessPlant: invitation.userType === 'internal',
            accessVariations: invitation.userType === 'internal',
            accessPermits: true,
            accessTraining: true,
            accessClientInstructions: true,
            accessSiteInstructions: true,
            accessCleanupNotices: true,
            accessSnagging: true,
            accessQualityControl: true,
            accessInfoRequests: true,
            accessPaymentNotices: invitation.userType === 'internal',
            accessSubContractOrders: invitation.userType === 'internal',
            accessIRS: true,
            accessPlanner: true,
            accessProcurement: invitation.userType === 'internal',
            accessHolidays: true,
            accessSiteDiary: true,
            accessDocuments: true,
            accessFormEditor: false,
            accessInsights: invitation.userType === 'internal',
        };

        await setDoc(docRef, {
          id: email,
          name: invitation.name,
          email: email,
          password: password,
          userType: invitation.userType,
          requirePasswordChange: false,
          permissions
        });

        // 2. Auto-assign to project if defined AND valid
        if (invitation.projectId && invitation.projectId !== 'none') {
            const projectRef = doc(db, 'projects', invitation.projectId);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                await updateDoc(projectRef, {
                    assignedUsers: arrayUnion(email)
                });
            }
        }

        // 3. Close Invitation
        const inviteRef = doc(db, 'invitations', invitation.id);
        await updateDoc(inviteRef, { status: 'accepted' });

        // 4. Set session
        localStorage.setItem('sitecommand_v3_identity', email);
        localStorage.setItem('sitecommand_v3_token', `onboard-${Date.now()}`);
        
        toast({ title: 'Welcome aboard!', description: 'Your account has been created successfully.' });
        
        // Force cross-tab sync and reload
        window.dispatchEvent(new Event('storage'));
        window.location.assign('/');
      } catch (err) {
        console.error("Onboarding error:", err);
        toast({ title: 'Error', description: 'Failed to complete registration. Please contact support.', variant: 'destructive' });
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  if (inviteLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!invitation) {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
            <Card className="max-w-md w-full text-center">
                <CardHeader>
                    <CardTitle>Invitation Not Found</CardTitle>
                    <CardDescription>The link may be expired or used. Please contact your administrator for a new invite.</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button className="w-full" onClick={() => router.push('/login')}>Return to Login</Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full">
                <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-primary">Complete Your Access</h1>
                <p className="mt-2 text-muted-foreground">Welcome, <strong>{invitation.name}</strong>. Set your secure password to join the project team.</p>
            </div>
          </div>

          <form onSubmit={handleJoin}>
            <Card className="shadow-xl border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <KeyRound className="h-5 w-5 text-primary" />
                        Account Setup
                    </CardTitle>
                    <CardDescription>Your email <strong>{invitation.email}</strong> is already verified.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Create Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            required
                            minLength={6}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirm Password</Label>
                        <Input
                            id="confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            required
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Setting up Profile...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                Join the Project
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
          </form>

          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-dashed border-primary/20">
            {invitation.userType === 'internal' ? <ShieldCheck className="h-6 w-6 text-primary" /> : <Users2 className="h-6 w-6 text-accent" />}
            <p className="text-xs text-muted-foreground leading-relaxed">
                You are joining as a <strong>{invitation.userType}</strong> collaborator. Your project dashboard will be tailored to your role upon login.
            </p>
          </div>
        </div>
      </div>
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwzfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDB8fHx8MTczOTA4NjQyNXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Site Team"
          fill
          className="object-cover"
          priority
          data-ai-hint="construction teamwork"
        />
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px]" />
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <JoinContent />
    </Suspense>
  );
}
