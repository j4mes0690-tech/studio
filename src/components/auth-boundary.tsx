'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { LoadingScreen } from '@/components/loading-screen';
import { usePathname } from 'next/navigation';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * It waits for both the internal session (localStorage) and the 
 * Firebase Auth state (request.auth) to be initialized before rendering.
 * Allows specific public routes like /join to bypass authentication.
 * 
 * Enforces a minimum display time for the branded loading experience to prevent flickering.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const { isUserLoading: isFirebaseLoading } = useFirebase();
  const pathname = usePathname();
  
  // Track if the minimum required time for the splash screen has passed
  const [isMinimumTimeElapsed, setIsMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimumTimeElapsed(true);
    }, 2000); // 2 seconds minimum duration

    return () => clearTimeout(timer);
  }, []);

  // Show loading screen if auth logic is still working OR if the 2s timer hasn't finished
  if (isLoading || isFirebaseLoading || !isMinimumTimeElapsed) {
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
