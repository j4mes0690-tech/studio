
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDistributionUsers } from '@/lib/data';
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const users = await getDistributionUsers();

  return (
    <div className="flex flex-col w-full">
      <Header title="Settings" />
      <main className="flex-1 p-4 md:p-8 grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribution List</CardTitle>
            <CardDescription>
              Manage the users who can be notified about new instructions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersList users={users} />
          </CardContent>
        </Card>
        <Card className="lg:max-w-md">
          <CardHeader>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>
              Add a new user to the email distribution list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddUserForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
