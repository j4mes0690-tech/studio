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
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';

export default function AccountPage() {
  const { user } = useUser();
  const db = useFirestore();

  // We look up the user profile by their email, which we used as the document ID
  const profileRef = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return doc(db, 'users', user.email.toLowerCase().trim());
  }, [db, user?.email]);

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
                <div className="text-center space-y-4 max-w-md mx-auto">
                    <p className="text-lg font-semibold">Profile Not Found</p>
                    <p>You are logged in as <strong>{user?.email}</strong>, but we couldn't find a matching profile in the system.</p>
                    <p className="text-sm text-muted-foreground">An administrator needs to add your email to the <strong>Distribution List</strong> in Settings before you can manage your account profile here.</p>
                </div>
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
