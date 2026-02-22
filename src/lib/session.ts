
'use server';

import { cookies } from 'next/headers';
import type { DistributionUser } from './types';
import { getDistributionUsers } from './data';

const SESSION_COOKIE_NAME = 'session_userId';

export async function setSession(userId: string) {
  cookies().set(SESSION_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // One week
    path: '/',
    sameSite: 'lax',
  });
}

export async function getSession(): Promise<DistributionUser | null> {
    const userId = cookies().get(SESSION_COOKIE_NAME)?.value;

    if (!userId) {
        return null;
    }

    try {
        const users = await getDistributionUsers();
        const user = users.find(u => u.id === userId);
        return user || null;
    } catch (error) {
        console.error('Failed to get users for session validation:', error);
        return null;
    }
}

export async function clearSession() {
  cookies().delete(SESSION_COOKIE_NAME);
}
