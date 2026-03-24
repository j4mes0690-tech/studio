'use client';

import { useEffect, useState } from 'react';

type UserIdentity = {
  email: string;
};

/**
 * useUser - A reactive hook to manage and track the specific system session.
 * 
 * V3 UPDATE: Uses isolated namespaces to prevent identity bleed from legacy sessions.
 */
export function useUser() {
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resolveIdentity = () => {
      // V3 Namespaced Keys: Ensures no stale data from Kenzo's session is read.
      const sessionEmail = localStorage.getItem('sitecommand_v3_identity');
      const currentSessionId = localStorage.getItem('sitecommand_v3_token');
      
      if (sessionEmail && currentSessionId) {
        setUser({ email: sessionEmail.toLowerCase().trim() });
        setSessionId(currentSessionId);
      } else {
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
