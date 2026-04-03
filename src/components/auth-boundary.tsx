'use client';

import React, { useState, useEffect } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { LoadingScreen } from '@/components/loading-screen';
import { usePathname } from 'next/navigation';

/**
 * AuthBoundary - Protects routes and ensures Firebase services are ready.
 * 
 * Standardizes on the system identity (email) for protection logic while 
 * ensuring Firebase Auth is synchronized.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, email, sessionId, isLoading } = useUser();
  const pathname = usePathname();
  
  const [isMinimumTimeElapsed, setIsMinimumTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinimumTimeElapsed(true);
    }, 1500); 

    return () => clearTimeout(timer);
  }, []);

  // Show branding splash during initial boot
  if (isLoading || !isMinimumTimeElapsed) {
    return <LoadingScreen />;
  }

  // Bypassing for Onboarding route
  if (pathname === '/join') {
    return <>{children}</>;
  }

  // Redirect to login if no system identity exists in local storage
  if (!email) {
    return <LoginPage />;
  }

  // Ensure children are keyed by sessionId to force a fresh React tree on identity change
  return <div key={sessionId || 'anonymous'} className="contents">{children}</div>;
}
