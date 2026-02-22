
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
import { AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function LoginForm() {
  const auth = useAuth();
  const [email, setEmail] = useState('admin@example.com');
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
        message = 'The API key in src/firebase/config.ts is invalid. Please replace it with the valid key from your Firebase Console settings.';
        isConfig = true;
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please ensure you have created this user in the Firebase Console.';
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
    <form onSubmit={handleLogin}>
        <Card>
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
                        placeholder="admin@example.com"
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
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{error.title}</AlertTitle>
                        <AlertDescription className="space-y-2">
                            <p>{error.message}</p>
                            {error.isConfig && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full mt-2 bg-white text-destructive hover:bg-destructive/10"
                                    asChild
                                >
                                    <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-3 w-3" />
                                        Go to Firebase Console
                                    </a>
                                </Button>
                            )}
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
  );
}
