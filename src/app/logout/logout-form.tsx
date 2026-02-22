'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { logoutAction } from './actions';
import Link from 'next/link';

function LogoutButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Logging out...' : 'Confirm Log Out'}
        </Button>
    );
}

export function LogoutForm() {
    return (
        <form action={logoutAction} className="space-y-4">
            <LogoutButton />
            <Button variant="outline" className="w-full" asChild>
                <Link href="/">Cancel</Link>
            </Button>
        </form>
    );
}
