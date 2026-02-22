
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialError = searchParams.get('error');
    const [error, setError] = useState<string | null>(initialError);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsPending(true);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (result.success) {
                router.push('/');
                router.refresh();
            } else {
                setError(result.error || 'Login failed.');
                setIsPending(false);
            }
        } catch (e) {
            setError('An unexpected error occurred.');
            setIsPending(false);
        }
    };

    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                <div className="mb-4 flex justify-center">
                    <Logo />
                </div>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertTitle>Login Failed</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="john.doe@example.com"
                                required
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                disabled={isPending}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending ? 'Logging in...' : 'Log In'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center">Loading...</div>}>
            <LoginPageContent />
        </Suspense>
    )
}
