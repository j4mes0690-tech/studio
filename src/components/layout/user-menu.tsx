'use client';

import Link from 'next/link';
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
import type { DistributionUser } from '@/lib/types';

function getInitials(profile: DistributionUser | null, email: string) {
    if (profile?.name) {
        const nameParts = profile.name.trim().split(/\s+/).filter(Boolean);
        if (nameParts.length >= 2) {
            return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
        }
        return nameParts[0].charAt(0).toUpperCase();
    }
    return email?.charAt(0).toUpperCase() || 'U';
}

export function UserMenu({ profile, email }: { profile: DistributionUser | null, email: string }) {
    const initials = getInitials(profile, email);
    
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
                <DropdownMenuLabel>{profile?.name || email || 'My Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/account">Account Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/settings">System Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer text-destructive focus:text-destructive">
                    <Link href="/logout">Log Out</Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
