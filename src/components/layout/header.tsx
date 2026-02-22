
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/data';
import { UserMenu } from './user-menu';

export async function Header({ title }: { title: string }) {
  const currentUser = await getCurrentUser();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      {currentUser && <SidebarTrigger className="md:hidden" />}
      <div className="w-full flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>

      <div className="text-sm text-muted-foreground">
        {currentUser ? `Logged in as: ${currentUser.name}` : 'Not Logged In'}
      </div>

      {title !== 'Dashboard' && (
        <Button asChild variant="ghost" size="icon">
          <Link href="/">
            <Home className="h-5 w-5" />
            <span className="sr-only">Home</span>
          </Link>
        </Button>
      )}

      {currentUser && <UserMenu user={currentUser} />}
    </header>
  );
}
