
'use client';

import { useEffect, useState } from 'react';
import {
  Query,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';

/**
 * useCollection - Robust hook for real-time Firestore collections.
 * Prevents "loading flicker" by keeping existing data while re-subscribing.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      setIsLoading(false);
      return;
    }

    // Only set loading to true if we don't have data yet.
    // This prevents the UI from clearing during background re-syncs.
    if (!data) {
      setIsLoading(true);
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const items = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        } as T));
        
        setData(items);
        setIsLoading(false);
      },
      (err) => {
        console.error('Firestore collection error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]); // Stability depends on the caller using useMemo for the query

  return { data, isLoading, error };
}
