
'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/sidebar';
import { usePathname } from 'next/navigation';

/**
 * AppShell - Provides the main application layout including the sidebar.
 * It conditionally renders the sidebar based on the current route to allow
 * for standalone public pages like Login and Join.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Define routes that should not show the sidebar/navigation shell
  const isPublicPage = pathname === '/login' || pathname === '/join';

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
