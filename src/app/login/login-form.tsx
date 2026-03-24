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
    HelpCircle, 
    Info, 
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * LoginForm - Manages the custom simulation session for SiteCommand.
 * 
 * FIX: Switched to direct DOM extraction via FormData during submission.
 * This ensures that if a browser autofills the fields, we capture the 
 * absolute current value displayed to the user, preventing identity 
 * mismatches caused by stale React state.
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
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const [prototypePassword, setPrototypePassword] = useState<string | null>(null);

  useEffect(() => {
    const seedInitialUsers = async () => {
      if (!db) return;
      setIsSeeding(true);
      try {
        const usersToSeed = [
          { email: 'admin@example.com', name: 'System Admin', password: '123456', isAdmin: true },
          { email: 'james@hallcc.co.uk', name: 'James Hall', password: '123456', isAdmin: false }
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

    // 1. Wipe all local data immediately to prevent identity cross-talk
    localStorage.clear();

    try {
      // 2. Extract values directly from the form elements
      const formData = new FormData(e.currentTarget);
      const rawEmail = formData.get('email') as string;
      const rawPassword = formData.get('password') as string;
      
      const emailKey = rawEmail.toLowerCase().trim();
      
      if (!emailKey || !rawPassword) {
          setError({ title: 'Input Required', message: 'Please enter both email and password.' });
          setIsLoading(false);
          return;
      }

      // 3. Document Lookup by Normalized Key
      const userRef = doc(db, 'users', emailKey);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        // 4. Constant-time-like comparison (simulation)
        if (userData.password === rawPassword) {
          // 5. Explicitly lock the session to the TYPED emailKey
          localStorage.setItem('sitecommand_session_email', emailKey);
          window.location.href = '/';
        } else {
          setError({ title: 'Access Denied', message: 'Incorrect password for this account.' });
        }
      } else {
        setError({ 
          title: 'Account Unknown', 
          message: `The account "${emailKey}" does not exist in the site registry.` 
        });
      }
    } catch (err: any) {
      setError({ title: 'System Error', message: 'Could not connect to user database.' });
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
        <form onSubmit={handleLogin}>
            <Card className={cn("shadow-xl border-2 transition-all", error ? "border-destructive ring-4 ring-destructive/10" : "border-primary/10")}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-primary" />
                        Log In
                    </CardTitle>
                    <CardDescription>Enter credentials to access the project hub.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="your@email.com"
                            required
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            
                            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="link" type="button" className="h-auto p-0 text-xs text-primary">
                                        Forgot Password?
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Recovery</DialogTitle>
                                        <DialogDescription>Request a temporary login password.</DialogDescription>
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
                            required 
                            autoComplete="current-password"
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
                    <Button type="submit" className="w-full h-11 text-lg font-bold" disabled={isLoading || isSeeding}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Log In'}
                    </Button>
                </CardFooter>
            </Card>
        </form>

        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-snug">
                SiteCommand is an internal management system. Access restricted to authorized project personnel only.
            </p>
        </div>
    </div>
  );
}
