
'use client';

import { useEffect, useState } from 'react';

/**
 * useUser - A custom hook to manage internal authentication state.
 * It tracks the logged-in user via localStorage and provides a consistent interface.
 */
export function useUser() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // We check localStorage for a session marker
    const sessionEmail = localStorage.getItem('sitecommand_session_email');
    if (sessionEmail) {
      setUser({ email: sessionEmail });
    }
    setIsLoading(false);

    // Listen for changes in other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sitecommand_session_email') {
        setUser(e.newValue ? { email: e.newValue } : null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { user, isLoading };
}
