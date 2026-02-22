'use server';

// Stale server actions removed.
// System settings are now managed directly via the Firestore client SDK in the UI.

export type FormState = {
  message: string;
  success: boolean;
};

export async function addSubContractorAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function removeSubContractorAction(userId: string) {
  // Deprecated
}

export async function updateSubContractorAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function addProjectAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function removeProjectAction(projectId: string) {
  // Deprecated
}

export async function updateProjectAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
