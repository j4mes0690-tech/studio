'use client';

import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { Loader2 } from 'lucide-react';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * It waits for both the internal session (localStorage) and the 
 * Firebase Auth state (request.auth) to be initialized before rendering.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { isUserLoading: isFirebaseLoading } = useFirebase();

  if (isLoading || isFirebaseLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
