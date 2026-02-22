
'use server';

import { clearSession } from '@/lib/session';

export type LogoutState = {
  error?: string;
  success?: boolean;
};

export async function logoutAction(): Promise<LogoutState> {
  try {
    await clearSession();
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unknown error occurred during logout.' };
  }
}
