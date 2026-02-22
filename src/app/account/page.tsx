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

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  // Middleware now handles the auth check, but we still need the user data.
  const currentUser = await getCurrentUser();

  // This should not be possible if middleware is working, but it's a good safeguard.
  if (!currentUser) {
    return null;
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
