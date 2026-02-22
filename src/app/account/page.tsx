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

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  // In a real app, you'd get the currently logged-in user.
  // For this prototype, we'll just take the first user from the list.
  const users = await getDistributionUsers();
  const currentUser = users[0];

  if (!currentUser) {
    return (
      <div className="flex flex-col w-full">
        <Header title="My Account" />
        <main className="flex-1 p-4 md:p-8">
          <p>No user found.</p>
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
