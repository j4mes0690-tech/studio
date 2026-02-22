import { Header } from '@/components/layout/header';
import { getCurrentUser } from '@/lib/data';
import { AccountForm } from './account-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // In a real app with proper auth, this would be handled by middleware
    // For now, redirect to login if no user session is found.
    redirect('/login');
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
                <AccountForm user={currentUser} />
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
