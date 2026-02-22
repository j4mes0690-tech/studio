'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from './actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
      {pending ? 'Logging out...' : 'Confirm Log Out'}
    </Button>
  );
}

export function LogoutForm() {
  return (
    <div className='flex flex-col gap-4'>
        <form action={logoutAction}>
            <LogoutButton />
        </form>
        <Button variant="outline" asChild>
            <Link href="/">Cancel</Link>
        </Button>
    </div>
  );
}
