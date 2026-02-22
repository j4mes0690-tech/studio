
'use server';

/**
 * Stale server actions removed. 
 * Clean up notices are now managed directly via the Firestore client SDK in the UI.
 */

export type FormState = {
  message: string;
  success: boolean;
};

export async function createCleanUpNoticeAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
