
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
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
