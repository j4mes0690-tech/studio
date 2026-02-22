
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction, type LogoutState } from './actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} variant="destructive">
      {pending ? 'Logging out...' : 'Confirm Log Out'}
    </Button>
  );
}

export function LogoutForm() {
  const [state, formAction] = useActionState<LogoutState | undefined, void>(logoutAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push('/login');
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <LogoutButton />
       <Button variant="outline" asChild className="w-full">
        <Link href="/">Cancel</Link>
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
