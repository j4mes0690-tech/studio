'use client';

import { useEffect, useState } from 'react';

type UserIdentity = {
  email: string;
};

/**
 * useUser - A reactive hook to manage and track the specific system session.
 * 
 * It monitors both the session email and a unique sessionId. If the sessionId
 * changes (e.g., due to a fresh login or a total wipe), this hook facilitates 
 * a clean tree reset via the AuthBoundary key.
 */
export function useUser() {
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resolveIdentity = () => {
      // Pull directly from storage to get the truth of the current tab context.
      const sessionEmail = localStorage.getItem('sitecommand_session_email');
      const currentSessionId = localStorage.getItem('sitecommand_session_id');
      
      if (sessionEmail && currentSessionId) {
        setUser({ email: sessionEmail.toLowerCase().trim() });
        setSessionId(currentSessionId);
      } else {
        // If either is missing, the session is invalid or has been logged out.
        setUser(null);
        setSessionId(null);
      }
      setIsLoading(false);
    };

    // Initial check
    resolveIdentity();

    // Listen for storage changes from other tabs or the login/logout lifecycle.
    const onStorageChange = () => {
      resolveIdentity();
    };

    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, []);

  return { user, sessionId, isLoading };
}