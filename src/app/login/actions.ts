
'use server';

// Stale login actions removed.
// Authentication is handled via the Firebase Client SDK in the LoginForm component.

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  return { error: 'This action is deprecated. Please use the client-side login form.' };
}
