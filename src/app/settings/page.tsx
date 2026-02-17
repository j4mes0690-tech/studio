
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDistributionUsers, getSubContractors } from '@/lib/data';
import { UsersList } from './users-list';
import { AddUserForm } from './add-user-form';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { SubcontractorsList } from './subcontractors-list';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [users, subContractors] = await Promise.all([
      getDistributionUsers(),
      getSubContractors()
  ]);

  return (
    <div className="flex flex-col w-full">
      <Header title="Settings" />
      <main className="flex-1 p-4 md:p-8">
        <div className="grid gap-8">
            <Card>
            <CardHeader>
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                Add or remove users from lists.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-medium">Distribution List</h3>
                        <p className="text-sm text-muted-foreground">
                            Users who can be notified about new instructions.
                        </p>
                    </div>
                    <AddUserForm />
                    <Separator />
                    <UsersList users={users} />
                </div>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-medium">Sub-Contractors</h3>
                        <p className="text-sm text-muted-foreground">
                            Sub-contractors who can receive clean up notices.
                        </p>
                    </div>
                    <AddSubcontractorForm />
                    <Separator />
                    <SubcontractorsList subContractors={subContractors} />
                </div>
            </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
