
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';
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
import { AlertTriangle } from 'lucide-react';
import Image from 'next/image';

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Logging in...' : 'Log In'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState | undefined, FormData>(loginAction, undefined);

  return (
    <form action={formAction}>
        <Card>
            <CardHeader>
                <CardTitle>Log In</CardTitle>
                <CardDescription>Use 'admin@example.com' and 'password' to continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="admin@example.com"
                        required
                        defaultValue="admin@example.com"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required defaultValue="password" />
                </div>

                {state?.error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Login Failed</AlertTitle>
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}

            </CardContent>
            <CardFooter>
                 <LoginButton />
            </CardFooter>
        </Card>
    </form>
  );
}
