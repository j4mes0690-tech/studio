'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { LoadingScreen } from '@/components/loading-screen';
import { usePathname } from 'next/navigation';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * 
 * V3 UPDATE: Implements a specific wait state for the onboarding (/join) route.
 * Even though /join doesn't require a system user account, it MUST wait for 
 * the Firebase auth state (anonymous sign-in) to initialize, or Firestore 
 * security rules will block the invitation lookup.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, sessionId, isLoading: isSessionLoading } = useUser();
  const { isUserLoading: isFirebaseLoading } = useFirebase();
  const pathname = usePathname();
  
  const [isMinimumTimeElapsed, setIsMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimumTimeElapsed(true);
    }, 2000); 

    return () => clearTimeout(timer);
  }, []);

  // ALWAYS wait for Firebase Auth and Session state to finish initial load.
  // This prevents race conditions where /join tries to read from DB before anonymous auth is ready.
  if (isSessionLoading || isFirebaseLoading || !isMinimumTimeElapsed) {
    return <LoadingScreen />;
  }

  // Bypassing for Onboarding: Now safe because we know Firebase is ready.
  if (pathname === '/join') {
    return <>{children}</>;
  }

  // Standard protection for the rest of the app.
  if (!user) {
    return <LoginPage />;
  }

  // Keying the children by sessionId ensures NO stale React state survives a logout/login cycle
  return <div key={sessionId || 'empty'} className="contents">{children}</div>;
}
