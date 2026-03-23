'use client';

import { Button } from '@/components/ui/button';
import { Home, Loader2, Settings, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { UserMenu } from './user-menu';
import { NotificationsMenu } from './notifications-menu';
import { usePathname } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { DistributionUser, SystemSettings } from '@/lib/types';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

export function Header({ title }: { title: string }) {
  const { user: sessionUser, isLoading: sessionLoading } = useUser();
  const db = useFirestore();
  const pathname = usePathname();

  // Fetch the full user profile
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // Fetch branding for the logo
  const brandingRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'system-settings', 'branding');
  }, [db]);
  const { data: branding } = useDoc<SystemSettings>(brandingRef);

  const isLoading = sessionLoading || profileLoading;

  const hasAnyAdminPermission = !!(
    profile?.permissions &&
    (profile.permissions.canManageUsers ||
      profile.permissions.canManageSubcontractors ||
      profile.permissions.canManageProjects ||
      profile.permissions.canManageChecklists)
  );

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 sticky top-0 z-40 backdrop-blur-sm">
      <div className="flex items-center gap-4 flex-1">
        {pathname !== '/' && (
          <Link href="/" className="hover:opacity-80 transition-opacity hidden sm:block">
            <Logo hideText iconClassName="h-8 w-8" src={branding?.logoUrl} />
          </Link>
        )}
        <h1 className="text-sm md:text-lg font-bold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : sessionUser ? (
          <>
            <div className="text-xs text-muted-foreground hidden lg:block font-medium">
              {profile?.name || sessionUser.email}
            </div>

            <Button asChild variant="ghost" size="icon" className={cn(pathname === '/' && "hidden")}>
              <Link href="/">
                <Home className="h-5 w-5" />
                <span className="sr-only">Home</span>
              </Link>
            </Button>

            <NotificationsMenu userEmail={sessionUser.email} />

            {hasAnyAdminPermission && (
              <Button asChild variant="ghost" size="icon">
                <Link href="/settings">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Link>
              </Button>
            )}

            <UserMenu profile={profile} email={sessionUser.email} />
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Not Logged In
          </div>
        )}
      </div>
    </header>
  );
}
