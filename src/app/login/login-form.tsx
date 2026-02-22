'use client';

import { useState } from 'react';
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
import { AlertTriangle, Loader2, ExternalLink, Info } from 'lucide-react';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function LoginForm() {
  const auth = useAuth();
  const [email, setEmail] = useState('j4mes0690@googlemail.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<{title: string, message: string, isConfig: boolean} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Firebase Auth Error:', err);
      
      let title = 'Login Failed';
      let message = 'Failed to log in. Please check your credentials.';
      let isConfig = false;

      if (err.code === 'auth/api-key-not-valid') {
        title = 'Invalid Firebase API Key';
        message = 'The API key in src/firebase/config.ts is invalid. Please replace it with the valid key from your Firebase Console settings (Project Settings > General).';
        isConfig = true;
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        title = 'Account Not Found in Firebase';
        message = 'This email/password combination was not found. You must manually add this user to the "Users" tab in your Firebase Console before you can log in.';
      } else if (err.code === 'auth/operation-not-allowed') {
        title = 'Auth Provider Disabled';
        message = 'Email/Password sign-in is not enabled. Go to Authentication > Sign-in method in the Firebase Console to enable it.';
        isConfig = true;
      }

      setError({ title, message, isConfig });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
        <form onSubmit={handleLogin}>
            <Card className={error ? "border-destructive" : ""}>
                <CardHeader>
                    <CardTitle>Log In</CardTitle>
                    <CardDescription>Enter your credentials to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="j4mes0690@googlemail.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input 
                            id="password" 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>

                    {error && (
                        <Alert variant="destructive" className="bg-destructive/5">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{error.title}</AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>{error.message}</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full mt-2 bg-white text-destructive hover:bg-destructive/10"
                                    asChild
                                >
                                    <a href="https://console.firebase.google.com/project/sitecommand2-93834253-fc971/authentication/users" target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-3 w-3" />
                                        Open Firebase User List
                                    </a>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Logging in...
                            </>
                        ) : 'Log In'}
                    </Button>
                </CardFooter>
            </Card>
        </form>

        <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Required Action: Add User</AlertTitle>
            <AlertDescription className="text-xs space-y-3 pt-2">
                <p className="font-semibold">The app is connected to project "sitecommand2-93834253-fc971". To log in, you must add your account to that project:</p>
                <ol className="list-decimal ml-4 space-y-2">
                    <li>Open the <a href="https://console.firebase.google.com/project/sitecommand2-93834253-fc971/authentication/users" target="_blank" className="underline font-bold">Firebase Console Users Tab</a>.</li>
                    <li>Ensure <strong>Email/Password</strong> is enabled in "Sign-in method".</li>
                    <li>Click the <strong>Add user</strong> button.</li>
                    <li>Use Email: <code>j4mes0690@googlemail.com</code></li>
                    <li>Use Password: <code>password</code></li>
                </ol>
                <p className="italic text-muted-foreground">Note: The "Account Not Found" error will persist until the user is added in the console.</p>
            </AlertDescription>
        </Alert>
    </div>
  );
}
