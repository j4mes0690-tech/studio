'use client';

import { usePathname } from 'next/navigation';
import { SiteAgentWidget } from '@/components/ai-agent/chat-widget';

/**
 * AppShell - Provides the main application layout.
 * The side menu has been removed to provide a cleaner, full-width interface.
 * Navigation is managed via the Dashboard and Header home links.
 * 
 * Embedded Components:
 * - SiteAgentWidget: Persistent AI assistant accessible everywhere.
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
      
      {/* Global Site Intelligence Agent */}
      <SiteAgentWidget />
    </div>
  );
}
