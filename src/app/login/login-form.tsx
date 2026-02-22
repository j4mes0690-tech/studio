
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
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function LoginForm() {
  const db = useFirestore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Internal Auth: Query the 'users' collection directly
      const emailKey = email.toLowerCase().trim();
      const userRef = doc(db, 'users', emailKey);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.password === password) {
          // Store session locally
          localStorage.setItem('sitecommand_session_email', userData.email);
          // Hard reload to update all contexts
          window.location.reload();
        } else {
          setError({ title: 'Login Failed', message: 'Incorrect password for this account.' });
        }
      } else {
        setError({ 
          title: 'Account Not Found', 
          message: 'This email is not registered in the system. Please contact your administrator.' 
        });
      }
    } catch (err: any) {
      console.error('System Auth Error:', err);
      setError({ 
        title: 'Database Connection Error', 
        message: 'Could not reach the user database. Please check your internet connection.' 
      });
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
                            <AlertDescription>
                                {error.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
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
    </div>
  );
}
