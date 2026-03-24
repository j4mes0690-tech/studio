'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { LoadingScreen } from '@/components/loading-screen';
import { usePathname } from 'next/navigation';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * 
 * Uses a unique sessionId as a React 'key' to force-reset the entire
 * component tree when a user identity changes.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, sessionId, isLoading } = useUser();
  const { isUserLoading: isFirebaseLoading } = useFirebase();
  const pathname = usePathname();
  
  const [isMinimumTimeElapsed, setIsMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimumTimeElapsed(true);
    }, 2000); 

    return () => clearTimeout(timer);
  }, []);

  if (isLoading || isFirebaseLoading || !isMinimumTimeElapsed) {
    return <LoadingScreen />;
  }

  if (pathname === '/join') {
    return <>{children}</>;
  }

  if (!user) {
    return <LoginPage />;
  }

  // Keying the children by sessionId ensures NO stale React state survives a logout/login cycle
  return <div key={sessionId || 'empty'} className="contents">{children}</div>;
}
