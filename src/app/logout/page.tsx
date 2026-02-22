import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { LogoutForm } from './logout-form';

export default function LogoutPage() {
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                <div className="mb-4 flex justify-center">
                    <Logo />
                </div>
                <CardTitle>Log Out</CardTitle>
                <CardDescription>Are you sure you want to log out?</CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense>
                        <LogoutForm />
                    </Suspense>
                </CardContent>
            </Card>
        </main>
    );
}
