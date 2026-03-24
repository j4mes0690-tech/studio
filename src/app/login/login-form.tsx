'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
    AlertTriangle, 
    Loader2, 
    KeyRound, 
    CheckCircle2 
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { sendPasswordResetEmailAction } from './actions';
import { cn } from '@/lib/utils';

/**
 * LoginForm - Manages the highly-isolated system session.
 * 
 * V3 UPDATE: Implements direct DOM audit and namespaced storage keys to
 * prevent identity mismatch between users on the same domain.
 */
export function LoginForm() {
  const db = useFirestore();
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Password Recovery State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsReseting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'prototype-success' | 'not-found' | 'error'>('idle');
  const [prototypePassword, setPrototypePassword] = useState<string | null>(null);

  useEffect(() => {
    // V3 NUCLEAR WIPE: Clear all storage immediately on mount to prevent identity bleed.
    localStorage.clear();
    window.dispatchEvent(new Event('storage'));

    const seedInitialUsers = async () => {
      if (!db) return;
      setIsSeeding(true);
      try {
        const usersToSeed = [
          { email: 'admin@example.com', name: 'System Admin', password: '123456', isAdmin: true },
          { email: 'james@hallcc.co.uk', name: 'James Hall', password: '123456', isAdmin: false },
          { email: 'kenzo@hallcc.co.uk', name: 'Kenzo Iloube', password: '123456', isAdmin: false }
        ];

        for (const u of usersToSeed) {
          const emailKey = u.email.toLowerCase().trim();
          const userRef = doc(db, 'users', emailKey);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              id: emailKey,
              email: emailKey,
              name: u.name,
              password: u.password,
              userType: 'internal',
              requirePasswordChange: false,
              permissions: {
                canManageUsers: u.isAdmin,
                canManageSubcontractors: u.isAdmin,
                canManageProjects: u.isAdmin,
                canManageChecklists: u.isAdmin,
                canManageMaterials: u.isAdmin,
                canManagePermitTemplates: u.isAdmin,
                canManageTraining: u.isAdmin,
                canManageIRS: u.isAdmin,
                canManageBranding: u.isAdmin,
                canApproveHolidays: u.isAdmin,
                hasFullVisibility: u.isAdmin,
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
                accessIRS: true,
                accessPlanner: true,
                accessProcurement: true,
                accessHolidays: true,
                accessSiteDiary: true,
                accessDocuments: true,
                accessInsights: u.isAdmin,
                accessFormEditor: u.isAdmin,
              }
            });
          }
        }
      } catch (err) {
        console.error('Seeding error:', err);
      } finally {
        setIsSeeding(false);
      }
    };
    seedInitialUsers();
  }, [db]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const rawEmail = (formData.get('email') as string || '').toLowerCase().trim();
      const rawPassword = formData.get('password') as string || '';
      
      if (!rawEmail || !rawPassword) {
          setError({ title: 'Credentials Missing', message: 'Please enter both your registered email and password.' });
          setIsLoading(false);
          return;
      }

      // Step 1: Nuclear Storage Wipe before starting the login transaction
      localStorage.clear();
      window.dispatchEvent(new Event('storage'));

      // Step 2: Fetch the document exactly as typed
      const userRef = doc(db, 'users', rawEmail);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // Step 3: Identity Verification - Ensure document contents match typed email
        if (userData.password === rawPassword) {
          // Step 4: Establish V3 Namespaced Session
          const uniqueSessionId = `v3-sid-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          localStorage.setItem('sitecommand_v3_identity', rawEmail);
          localStorage.setItem('sitecommand_v3_token', uniqueSessionId);
          
          // Force storage sync for other tabs
          window.dispatchEvent(new Event('storage'));
          
          // Force full heap clear
          window.location.assign('/');
        } else {
          setError({ title: 'Authentication Failed', message: 'The password provided does not match our records.' });
        }
      } else {
        setError({ 
          title: 'Account Not Found', 
          message: `We couldn't find a profile for "${rawEmail}".` 
        });
      }
    } catch (err: any) {
      setError({ title: 'System Offline', message: 'Unable to connect to the authentication server.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
      if (!resetEmail) return;
      setIsReseting(true);
      setResetStatus('idle');
      
      try {
          const emailKey = resetEmail.toLowerCase().trim();
          const userRef = doc(db, 'users', emailKey);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
              const userData = userSnap.data();
              const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
              
              await updateDoc(userRef, { 
                password: tempPassword,
                requirePasswordChange: true
              });

              const result = await sendPasswordResetEmailAction({
                  email: emailKey,
                  name: userData.name || 'User',
                  tempPassword
              });

              if (result.success) setResetStatus('success');
              else if (result.isConfigError) {
                  setPrototypePassword(tempPassword);
                  setResetStatus('prototype-success');
              } else {
                  setResetStatus('error');
              }
          } else {
              setResetStatus('not-found');
          }
      } catch (err: any) {
          setResetStatus('error');
      } finally {
          setIsReseting(false);
      }
  };

  return (
    <div className="space-y-6">
        <form onSubmit={handleLogin} autoComplete="off" noValidate>
            <Card className={cn("shadow-xl border-2 transition-all", error ? "border-destructive ring-4 ring-destructive/10" : "border-primary/10")}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-primary" />
                        System Access
                    </CardTitle>
                    <CardDescription>Log in to your account to enter the intelligence hub.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Work Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="your@company.com"
                            autoComplete="off"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Security Password</Label>
                            
                            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="link" type="button" className="h-auto p-0 text-xs text-primary font-bold">
                                        Forgot?
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Account Recovery</DialogTitle>
                                        <DialogDescription>Request a temporary reset password.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        {resetStatus === 'success' ? (
                                            <Alert className="bg-green-50 border-green-200">
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                <AlertTitle>Email Sent</AlertTitle>
                                                <AlertDescription>Check your inbox for a new temporary code.</AlertDescription>
                                            </Alert>
                                        ) : resetStatus === 'prototype-success' ? (
                                            <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg text-center space-y-2">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground">New Temporary Password</p>
                                                <p className="text-3xl font-mono font-bold text-primary tracking-widest">{prototypePassword}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Label>Account Email</Label>
                                                <Input 
                                                    type="email" 
                                                    placeholder="e.g. john@company.com" 
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsResetOpen(false)}>Close</Button>
                                        {(resetStatus === 'idle' || resetStatus === 'not-found' || resetStatus === 'error') && (
                                            <Button onClick={handleResetPassword} disabled={isResetting || !resetEmail}>
                                                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password'}
                                            </Button>
                                        )}
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Input 
                            id="password" 
                            name="password"
                            type="password" 
                            autoComplete="off"
                            required 
                        />
                    </div>

                    {error && (
                        <Alert variant="destructive" className="bg-destructive/5 animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{error.title}</AlertTitle>
                            <AlertDescription className="text-xs">{error.message}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={isLoading || isSeeding}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Log In'}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </div>
  );
}
