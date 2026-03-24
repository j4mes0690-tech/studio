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
import { Loader2, Sparkles, ShieldCheck, Users2, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawToken = searchParams.get('token');
  const token = useMemo(() => rawToken?.trim(), [rawToken]);
  
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch invitation details - Querying by token to allow for better error reporting on status
  const invitesQuery = useMemoFirebase(() => {
    if (!db || !token) return null;
    return query(collection(db, 'invitations'), where('token', '==', token));
  }, [db, token]);
  
  const { data: invitations, isLoading: inviteLoading } = useCollection<Invitation>(invitesQuery);
  const invitation = invitations && invitations.length > 0 ? invitations[0] : null;

  // Derive specific invitation states
  const isExpired = useMemo(() => {
    if (!invitation) return false;
    return new Date(invitation.expiresAt) < new Date();
  }, [invitation]);

  const isAlreadyUsed = useMemo(() => {
    if (!invitation) return false;
    return invitation.status === 'accepted';
  }, [invitation]);

  const isValid = invitation && !isExpired && !isAlreadyUsed;

  useEffect(() => {
    if (!inviteLoading && token) {
        if (!invitation) {
            console.warn(`Onboarding: Token "${token}" matched 0 results.`);
        } else if (isAlreadyUsed) {
            toast({ title: 'Link Used', description: 'This invitation has already been used. Please log in directly.', variant: 'destructive' });
        } else if (isExpired) {
            toast({ title: 'Link Expired', description: 'This invitation has expired. Please request a new one.', variant: 'destructive' });
        }
    }
  }, [inviteLoading, invitation, isExpired, isAlreadyUsed, token, toast]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !db || !isValid) return;

    if (password !== confirmPassword) {
        toast({ title: 'Passwords do not match', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const email = invitation.email.toLowerCase().trim();
        const userRef = doc(db, 'users', email);

        // Safety check: Don't overwrite if user somehow already exists
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            toast({ 
                title: 'Account Already Active', 
                description: 'A system profile already exists for this email. Please log in directly.',
                variant: 'destructive'
            });
            
            // Mark invite as accepted if user exists to prevent reuse of link
            const inviteRef = doc(db, 'invitations', invitation.id);
            await updateDoc(inviteRef, { status: 'accepted' });
            
            router.push('/login');
            return;
        }

        // 1. Create default permissions object
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

        // 2. Set the User Document
        await setDoc(userRef, {
          id: email,
          name: invitation.name,
          email: email,
          password: password,
          userType: invitation.userType,
          requirePasswordChange: false,
          permissions
        });

        // 3. Auto-assign to project if defined AND valid
        const targetProjectId = invitation.projectId;
        if (targetProjectId && targetProjectId !== 'none') {
            const projectRef = doc(db, 'projects', targetProjectId);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                await updateDoc(projectRef, {
                    assignedUsers: arrayUnion(email)
                });
            }
        }

        // 4. Close Invitation
        const inviteRef = doc(db, 'invitations', invitation.id);
        await updateDoc(inviteRef, { status: 'accepted' });

        // 5. Establish Session
        localStorage.setItem('sitecommand_v3_identity', email);
        localStorage.setItem('sitecommand_v3_token', `v3-sid-onboard-${Date.now()}`);
        
        toast({ title: 'Welcome aboard!', description: 'Your account has been created successfully.' });
        
        // Force cross-tab sync and reload
        window.dispatchEvent(new Event('storage'));
        window.location.assign('/');
      } catch (err) {
        console.error("Onboarding error:", err);
        toast({ title: 'Registration Failed', description: 'An unexpected error occurred. Please try again or contact support.', variant: 'destructive' });
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

  // Error UI for invalid states
  if (!invitation || isExpired || isAlreadyUsed) {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
            <Card className="max-w-md w-full text-center shadow-xl">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle>
                        {!invitation ? 'Invitation Not Found' : isAlreadyUsed ? 'Access Already Set' : 'Invitation Expired'}
                    </CardTitle>
                    <CardDescription className="text-sm">
                        {!invitation 
                            ? 'The link provided is invalid or has been removed. Please check the URL and try again.' 
                            : isAlreadyUsed 
                                ? 'This onboarding link has already been used to create an account.' 
                                : 'This invitation has expired. Links are valid for 7 days.'}
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex flex-col gap-3">
                    <Button className="w-full font-bold" onClick={() => router.push('/login')}>Go to Login</Button>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold text-center w-full">Contact your Site Manager for a new link</p>
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
                <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Complete Your Access</h1>
                <p className="mt-2 text-muted-foreground">Welcome, <strong>{invitation.name}</strong>. Set your secure password to join the project team.</p>
            </div>
          </div>

          <form onSubmit={handleJoin}>
            <Card className="shadow-2xl border-primary/20">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <KeyRound className="h-5 w-5 text-primary" />
                        Security Setup
                    </CardTitle>
                    <CardDescription>Your verified email: <strong>{invitation.email}</strong></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Create Secure Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            required
                            minLength={6}
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Repeat Password</Label>
                        <Input
                            id="confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat for confirmation"
                            required
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Setting up Profile...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" />
                                Join Project
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
          </form>

          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-dashed border-primary/20">
            {invitation.userType === 'internal' ? <ShieldCheck className="h-6 w-6 text-primary" /> : <Users2 className="h-6 w-6 text-accent" />}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
                You are joining as a <strong>{invitation.userType}</strong> collaborator. Your dashboard will be customized based on this role once you log in.
            </p>
          </div>
        </div>
      </div>
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw3fHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDB8fHx8MTczOTA4NjQyNXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Site Team"
          fill
          className="object-cover"
          priority
          data-ai-hint="construction team"
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
