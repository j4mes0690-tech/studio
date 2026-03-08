
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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

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
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'not-found' | 'error'>('idle');

  // Auto-seed the admin account in the background if it doesn't exist
  useEffect(() => {
    const seedAdmin = async () => {
      if (!db) return;
      setIsSeeding(true);
      try {
        const adminEmail = 'admin@example.com';
        const userRef = doc(db, 'users', adminEmail);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            id: adminEmail,
            email: adminEmail,
            name: 'System Admin',
            password: '123456',
            permissions: {
              canManageUsers: true,
              canManageSubcontractors: true,
              canManageProjects: true,
              canManageChecklists: true,
              canManageMaterials: true,
              canManagePermitTemplates: true,
              canManageTraining: true,
              hasFullVisibility: true,
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
        }
      } catch (err) {
        console.error('Error seeding admin user:', err);
      } finally {
        setIsSeeding(false);
      }
    };

    seedAdmin();
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

      try {
          const emailKey = resetEmail.toLowerCase().trim();
          const userRef = doc(db, 'users', emailKey);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
              // IN A PROTOTYPE: We'll simulate a reset by flagging the account
              // or just providing instructions. Since we don't have a real email link,
              // we'll instruct the user to contact the seeded admin.
              setResetStatus('success');
          } else {
              setResetStatus('not-found');
          }
      } catch (err) {
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
                                            Enter your registered email address to request a password reset.
                                        </DialogDescription>
                                    </DialogHeader>
                                    
                                    <div className="space-y-4 py-4">
                                        {resetStatus === 'success' ? (
                                            <Alert className="bg-green-50 border-green-200">
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                <AlertTitle className="text-green-800">Request Received</AlertTitle>
                                                <AlertDescription className="text-green-700 text-xs">
                                                    Your account has been identified. Please contact the <strong>System Administrator</strong> (admin@example.com) to receive your temporary access token.
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
                                            {resetStatus === 'success' ? 'Back to Login' : 'Cancel'}
                                        </Button>
                                        {resetStatus !== 'success' && (
                                            <Button onClick={handleResetPassword} disabled={isResetting || !resetEmail}>
                                                {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Find Account
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
