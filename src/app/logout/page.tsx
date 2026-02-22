
import { LogoutForm } from './logout-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LogoutPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <CardTitle>Log Out</CardTitle>
            <CardDescription>Are you sure you want to log out of SiteCommand?</CardDescription>
        </CardHeader>
        <CardContent>
            <LogoutForm />
        </CardContent>
      </Card>
    </div>
  );
}
