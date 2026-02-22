
'use server';

import { cookies } from 'next/headers';

// Stale session management removed.
// The app uses Firebase Auth's built-in client-side persistence and AuthBoundary for protection.

export async function setSession(userId: string) {
  // Deprecated
}

export async function getSession() {
    return null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session_userId');
}
