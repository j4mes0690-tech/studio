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

export function LoginForm() {
  const db = useFirestore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Forgot Password State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsReseting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'prototype-success' | 'not-found' | 'error'>('idle');
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const [prototypePassword, setPrototypePassword] = useState<string | null>(null);

  // Auto-seed initial accounts in the background
  useEffect(() => {
    const seedInitialUsers = async () => {
      if (!db) return;
      setIsSeeding(true);
      try {
        const usersToSeed = [
          {
            email: 'admin@example.com',
            name: 'System Admin',
            password: '123456',
            isAdmin: true
          },
          {
            email: 'james@hallcc.co.uk',
            name: 'James Hall',
            password: '123456',
            isAdmin: false
          }
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
              }
            });
          } else if (u.email === 'james@hallcc.co.uk' && userSnap.data().password !== u.password) {
            // Ensure James's password is set as requested
            await updateDoc(userRef, { password: u.password });
          }
        }
      } catch (err) {
        console.error('Error seeding users:', err);
      } finally {
        setIsSeeding(false);
      }
    };

    seedInitialUsers();
  }, [db]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const emailKey = email.toLowerCase().trim();
      if (!emailKey) {
          setError({ title: 'Input Required', message: 'Please enter your email address.' });
          setIsLoading(false);
          return;
      }

      const userRef = doc(db, 'users', emailKey);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.password === password) {
          localStorage.setItem('sitecommand_session_email', userData.email);
          window.location.href = '/';
        } else {
          setError({ title: 'Login Failed', message: 'Incorrect password for this account.' });
        }
      } else {
        setError({ 
          title: 'Account Not Found', 
          message: `The account "${emailKey}" is not registered in the system.` 
        });
      }
    } catch (err: any) {
      console.error('System Auth Error:', err);
      setError({ 
        title: 'Database Connection Error', 
        message: 'Could not reach the user database. Please try again later.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
      if (!resetEmail) return;
      setIsReseting(true);
      setResetStatus('idle');
      setResetErrorMessage(null);
      setPrototypePassword(null);

      try {
          const emailKey = resetEmail.toLowerCase().trim();
          const userRef = doc(db, 'users', emailKey);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
              const userData = userSnap.data();
              // Generate a random 8-char temporary password
              const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
              
              // 1. Update the password in Firestore immediately and set requirePasswordChange flag
              await updateDoc(userRef, { 
                password: tempPassword,
                requirePasswordChange: true
              }).catch(async (error) => {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({
                      path: userRef.path,
                      operation: 'update',
                      requestResourceData: { password: '***', requirePasswordChange: true }
                  }));
                  throw error;
              });

              // 2. Send the email via Resend server action
              const result = await sendPasswordResetEmailAction({
                  email: emailKey,
                  name: userData.name || 'User',
                  tempPassword
              });

              if (result.success) {
                  setResetStatus('success');
              } else if (result.isConfigError) {
                  // Reveal the password directly in prototype mode if email isn't configured
                  setPrototypePassword(tempPassword);
                  setResetStatus('prototype-success');
              } else {
                  setResetErrorMessage(result.message || 'The email service encountered an error.');
                  setResetStatus('error');
              }
          } else {
              setResetStatus('not-found');
          }
      } catch (err: any) {
          console.error('Reset workflow error:', err);
          setResetErrorMessage(err.message || 'An unexpected system error occurred.');
          setResetStatus('error');
      } finally {
          setIsReseting(false);
      }
  };

  return (
    <div className="space-y-6">
        <form onSubmit={handleLogin}>
            <Card className={error ? "border-destructive shadow-md" : "shadow-md"}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-primary" />
                        Log In
                    </CardTitle>
                    <CardDescription>Enter your system credentials to access SiteCommand.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            
                            <Dialog open={isResetOpen} onOpenChange={(val) => {
                                setIsResetOpen(val);
                                if (!val) {
                                    setResetStatus('idle');
                                    setResetEmail('');
                                    setResetErrorMessage(null);
                                    setPrototypePassword(null);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button variant="link" type="button" className="h-auto p-0 text-xs text-primary">
                                        Forgot Password?
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <HelpCircle className="h-5 w-5 text-primary" />
                                            Password Recovery
                                        </DialogTitle>
                                        <DialogDescription>
                                            Enter your registered email address to request a temporary login password.
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                        {resetStatus === 'success' ? (
                                            <Alert className="bg-green-50 border-green-200">
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                <AlertTitle className="text-green-800">Email Sent</AlertTitle>
                                                <AlertDescription className="text-green-700 text-xs">
                                                    We have identified your account and sent a <strong>temporary password</strong> to your email address. Please check your inbox (and spam folder).
                                                </AlertDescription>
                                            </Alert>
                                        ) : resetStatus === 'prototype-success' ? (
                                            <Alert className="bg-amber-50 border-amber-200">
                                                <Info className="h-4 w-4 text-amber-600" />
                                                <AlertTitle className="text-amber-800">Prototype Mode: Reset Complete</AlertTitle>
                                                <AlertDescription className="text-amber-700 text-xs space-y-3">
                                                    <p>The email service is not configured (missing RESEND_API_KEY), but your account has been updated in the database.</p>
                                                    <div className="p-3 bg-white border-2 border-amber-200 rounded-lg text-center">
                                                        <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Temporary Password</p>
                                                        <p className="text-2xl font-mono font-bold text-primary tracking-widest">{prototypePassword}</p>
                                                    </div>
                                                    <p className="font-medium">Use this code to log in, then update your password in Account Settings.</p>
                                                </AlertDescription>
                                            </Alert>
                                        ) : resetStatus === 'not-found' ? (
                                            <Alert variant="destructive" className="bg-destructive/5">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>Account Not Found</AlertTitle>
                                                <AlertDescription className="text-xs">
                                                    We couldn't find an active user profile for that email address.
                                                </AlertDescription>
                                            </Alert>
                                        ) : resetStatus === 'error' ? (
                                            <Alert variant="destructive" className="bg-destructive/5">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertTitle>Recovery Failed</AlertTitle>
                                                <AlertDescription className="text-xs">
                                                    {resetErrorMessage || "Could not process your reset request. Please contact your administrator."}
                                                </AlertDescription>
                                            </Alert>
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
                                        <Button variant="ghost" onClick={() => setIsResetOpen(false)}>
                                            {(resetStatus === 'success' || resetStatus === 'prototype-success') ? 'Back to Login' : 'Cancel'}
                                        </Button>
                                        {resetStatus !== 'success' && resetStatus !== 'prototype-success' && (
                                            <Button onClick={handleResetPassword} disabled={isResetting || !resetEmail}>
                                                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Send Temporary Password
                                            </Button>
                                        )}
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>

                    {error && (
                        <Alert variant="destructive" className="bg-destructive/5 animate-in fade-in slide-in-from-top-1">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{error.title}</AlertTitle>
                            <AlertDescription className="text-xs">
                                {error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full h-11 text-lg font-bold" disabled={isLoading || isSeeding}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Authenticating...
                            </>
                        ) : 'Log In'}
                    </Button>
                </CardFooter>
            </Card>
        </form>

        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-snug">
                SiteCommand is an internal construction management system. Access is restricted to authorised project personnel only.
            </p>
        </div>
    </div>
  );
}
