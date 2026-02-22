'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logoutAction } from '@/app/login/actions';
import type { DistributionUser } from '@/lib/types';

function getInitials(name?: string) {
    if (!name) return "";
    const nameParts = name.trim().split(' ').filter(Boolean);
    if (nameParts.length === 0) return "";
    if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
    }
    return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
}

export function UserMenu({ user }: { user: DistributionUser }) {
    const router = useRouter();
    const initials = getInitials(user?.name);
    const logoutFormRef = useRef<HTMLFormElement>(null);
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.name || 'My Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/account')} className="cursor-pointer">
                    Account
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/settings')} className="cursor-pointer">
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => {
                    logoutFormRef.current?.requestSubmit();
                }} className="cursor-pointer">
                    Logout
                </DropdownMenuItem>
                <form ref={logoutFormRef} action={logoutAction} className="hidden" />
            </DropdownMenuContent>
      </DropdownMenu>
    );
}
