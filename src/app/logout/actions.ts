
'use server';

import { clearSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export type LogoutState = {
  error?: string;
};

export async function logoutAction(): Promise<LogoutState> {
  try {
    await clearSession();
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unknown error occurred during logout.' };
  }
  redirect('/login');
}
