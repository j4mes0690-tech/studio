
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { UserMenu } from './user-menu';
import { usePathname } from 'next/navigation';

export function Header({ title }: { title: string }) {
  const { user, isLoading } = useUser();
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      {user && <SidebarTrigger className="md:hidden" />}
      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : user ? (
          <>
            <div className="text-sm text-muted-foreground hidden lg:block">
              Logged in as: {user.displayName || user.email}
            </div>

            {pathname !== '/' && (
              <Button asChild variant="ghost" size="icon">
                <Link href="/">
                  <Home className="h-5 w-5" />
                  <span className="sr-only">Home</span>
                </Link>
              </Button>
            )}

            <UserMenu user={user} />
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
