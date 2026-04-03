'use client';

import { useUser as useProviderUser } from '../provider';

/**
 * DEPRECATED: This file is preserved for backward compatibility but re-exports 
 * from the unified provider. Use useUser() from '@/firebase' instead.
 */
export function useUser() {
  return useProviderUser();
}
