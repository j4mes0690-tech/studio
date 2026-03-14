'use client';

import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { LoadingScreen } from '@/components/loading-screen';
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
    return <LoadingScreen />;
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
