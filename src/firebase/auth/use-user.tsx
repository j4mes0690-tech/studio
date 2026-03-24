'use client';

import { useEffect, useState } from 'react';

type UserIdentity = {
  email: string;
};

/**
 * useUser - A reactive hook to manage and track the specific system session.
 * 
 * It monitors both the session email and a unique sessionId. If the sessionId
 * changes (e.g., due to a fresh login), this hook facilitates a clean tree reset.
 */
export function useUser() {
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resolveIdentity = () => {
      // We pull directly from storage to get the truth of the current tab context
      const sessionEmail = localStorage.getItem('sitecommand_session_email');
      const currentSessionId = localStorage.getItem('sitecommand_session_id');
      
      if (sessionEmail && currentSessionId) {
        // Set identity as a fresh object to ensure sub-components react
        setUser({ email: sessionEmail.toLowerCase().trim() });
        setSessionId(currentSessionId);
      } else {
        setUser(null);
        setSessionId(null);
      }
      setIsLoading(false);
    };

    // Initial on-mount check
    resolveIdentity();

    // Listen for cross-tab session changes (logout in one tab should reflect in others)
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'sitecommand_session_email' || e.key === 'sitecommand_session_id') {
        resolveIdentity();
      }
    };

    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, []);

  return { user, sessionId, isLoading };
}
