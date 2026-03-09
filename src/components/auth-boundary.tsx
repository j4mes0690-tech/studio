
'use client';

import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * It waits for both the internal session (localStorage) and the 
 * Firebase Auth state (request.auth) to be initialized before rendering.
 * Allows specific public routes like /join to bypass authentication.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { isUserLoading: isFirebaseLoading } = useFirebase();
  const pathname = usePathname();

  if (isLoading || isFirebaseLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow the /join route to bypass the auth check so new collaborators can set their password
  if (pathname === '/join') {
    return <>{children}</>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
