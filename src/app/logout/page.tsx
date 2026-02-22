'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { logoutAction } from '@/app/login/actions';
import Link from 'next/link';

export default function LogoutConfirmationPage() {

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Log Out</CardTitle>
          <CardDescription>Are you sure you want to log out?</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/">Cancel</Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="destructive">
              Log Out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
