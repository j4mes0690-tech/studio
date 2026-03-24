'use client';

import { useEffect, useState } from 'react';

/**
 * useUser - A custom hook to manage internal authentication state.
 * Tracks the session email and a unique session ID to prevent state persistence issues.
 */
export function useUser() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = () => {
      const sessionEmail = localStorage.getItem('sitecommand_session_email');
      const sId = localStorage.getItem('sitecommand_session_id');
      
      if (sessionEmail && sId) {
        setUser({ email: sessionEmail });
        setSessionId(sId);
      } else {
        setUser(null);
        setSessionId(null);
      }
      setIsLoading(false);
    };

    // Initial check
    checkSession();

    // Listen for changes in other tabs or explicit logouts
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sitecommand_session_email' || e.key === 'sitecommand_session_id') {
        checkSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { user, sessionId, isLoading };
}
