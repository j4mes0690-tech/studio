
'use server';

/**
 * Stale server actions removed. 
 * Information requests are now managed directly via the Firestore client SDK in the UI.
 */

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInformationRequestAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateInformationRequestAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function addChatMessageAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
