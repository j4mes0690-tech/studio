
'use server';

// Stale server actions for account updates removed.
// User profiles are now managed directly via the Firestore client SDK in the UI.

export type FormState = {
  message: string;
  success: boolean;
};

export async function updateAccountAction(
    formData: FormData
  ): Promise<FormState> {
    return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
  }
