
'use client';

import { usePathname } from 'next/navigation';

/**
 * AppShell - Provides the main application layout.
 * The Site Intelligence widget has been removed to simplify the user interface.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define routes that should not show the standard shell
  const isPublicPage = pathname === '/login' || pathname === '/join';

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {children}
    </div>
  );
}
