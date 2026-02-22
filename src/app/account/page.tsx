
'use client';

import { Header } from '@/components/layout/header';
import { getDistributionUsers } from '@/lib/data';
import { AccountForm } from './account-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useEffect, useState } from 'react';
import type { DistributionUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function AccountPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<DistributionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (user?.email) {
        const users = await getDistributionUsers();
        const found = users.find(u => u.email === user.email);
        setProfile(found || null);
      }
      setLoading(false);
    }
    loadProfile();
  }, [user]);

  if (loading) {
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
                <div className="text-center space-y-4">
                    <p>Could not load user profile matching your login: <strong>{user?.email}</strong></p>
                    <p className="text-sm text-muted-foreground">Please contact an administrator to ensure your profile is set up in the Distribution list.</p>
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
                <CardTitle>My Account</CardTitle>
                <CardDescription>Update your personal information and password.</CardDescription>
            </CardHeader>
            <CardContent>
                <AccountForm user={profile} />
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
