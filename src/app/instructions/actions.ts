
'use server';

/**
 * Stale server actions removed. 
 * Instructions are now managed directly via the Firestore client SDK in the UI,
 * incorporating AI flows on the client side before persistence.
 */

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInstructionAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
