
'use server';

/**
 * Stale server actions removed. 
 * Snagging items are now managed directly via the Firestore client SDK in the UI.
 */

export type FormState = {
  message: string;
  success: boolean;
};

export async function createSnaggingItemAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateSnaggingItemAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
