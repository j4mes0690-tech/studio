'use client';

import { Header } from '@/components/layout/header';
import { AccountForm } from './account-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { DistributionUser } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { doc } from 'firebase/firestore';

export default function AccountPage() {
  const { email } = useUser();
  const db = useFirestore();

  // We look up the user profile by their registered system email
  const profileRef = useMemoFirebase(() => {
    if (!db || !email) return null;
    return doc(db, 'users', email.toLowerCase().trim());
  }, [db, email]);

  const { data: profile, isLoading } = useDoc<DistributionUser>(profileRef);

  if (isLoading) {
    return (
        <div className="flex flex-col w-full h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!profile) {
    return (
        <div className="flex flex-col w-full">
            <Header title="My Account" />
            <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
                <Card className="max-w-md w-full border-2 border-primary/20 shadow-xl text-center p-8 space-y-6">
                    <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
                        <ShieldAlert className="h-12 w-12 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-black">Profile Not Found</CardTitle>
                        <CardDescription>You are logged in as <strong>{email}</strong>, but your internal system profile is missing.</CardDescription>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        An administrator needs to re-register your account in <strong>System Settings</strong> to restore access to your profile management.
                    </p>
                </Card>
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <Header title="My Account" />
      <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Update your personal information. Login credentials must be managed separately.</CardDescription>
            </CardHeader>
            <CardContent>
                <AccountForm user={profile} />
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
