
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LogoutPage() {
  return (
    <div className="flex flex-col w-full">
      <Header title="Log Out" />
      <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Log Out</CardTitle>
            <CardDescription>Are you sure you want to log out?</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/logout" method="POST">
              <Button type="submit" className="w-full" variant="destructive">
                Confirm Log Out
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
