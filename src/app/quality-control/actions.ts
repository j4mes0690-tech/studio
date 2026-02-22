'use server';

// Stale server actions removed.
// Quality control records are now managed directly via the Firestore client SDK in the UI.

export type FormState = {
  message: string;
  success: boolean;
};

export async function createChecklistAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistItemsAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function assignChecklistAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistTemplateAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function deleteChecklistTemplateAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
