import { logoutAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function LogoutConfirmationPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle>Log Out</CardTitle>
          <CardDescription>Are you sure you want to log out of your account?</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logoutAction} className="space-y-4">
            <Button type="submit" variant="destructive" className="w-full">
              Confirm Logout
            </Button>
            <Button type="button" variant="outline" className="w-full" asChild>
                <a href="/">Cancel</a>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
