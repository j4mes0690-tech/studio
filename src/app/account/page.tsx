
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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // This can happen if the default user isn't found
    return (
        <div className="flex flex-col w-full">
            <Header title="My Account" />
            <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
                <p>Could not load user data.</p>
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
                <AccountForm user={currentUser} />
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
