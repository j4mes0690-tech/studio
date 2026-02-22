
'use server';

import { clearSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export type LogoutState = {
  error?: string;
  success?: boolean;
};

export async function logoutAction(): Promise<LogoutState> {
  try {
    await clearSession();
    revalidatePath('/', 'layout');
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unknown error occurred during logout.' };
  }
  redirect('/login');
}
