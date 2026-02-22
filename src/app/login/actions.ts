
'use server';

import { z } from 'zod';
import { getDistributionUsers } from '@/lib/data';
import { setSession } from '@/lib/session';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const validatedFields = LoginSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return { error: 'Invalid email or password.' };
  }

  const { email, password } = validatedFields.data;

  try {
    const users = await getDistributionUsers();
    const user = users.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      return { error: 'Invalid email or password.' };
    }

    await setSession(user.id);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: 'An unknown error occurred.' };
  }
}
