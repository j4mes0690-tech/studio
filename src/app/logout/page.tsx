
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LogoutPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold">Logout Disabled</h1>
        <p className="text-muted-foreground">
          The authentication system is temporarily disabled for maintenance.
        </p>
        <Button asChild>
            <Link href="/">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
