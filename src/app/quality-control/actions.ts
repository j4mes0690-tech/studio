
'use server';

/**
 * Stale server actions removed. 
 * Quality control records are now managed directly via the Firestore client SDK in the UI.
 */

export type FormState = {
  message: string;
  success: boolean;
};

export async function createChecklistAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistItemsAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistTemplateAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function deleteChecklistTemplateAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
