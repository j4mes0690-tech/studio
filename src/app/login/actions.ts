'use server';

import { redirect } from 'next/navigation';
import { getDistributionUsers } from '@/lib/data';
import { setSession } from '@/lib/session';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email('Invalid email address.'),
    password: z.string().min(1, 'Password is required.'),
});


export async function loginAction(
  prevState: { message: string } | undefined,
  formData: FormData
) {
  const validatedFields = LoginSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validatedFields.success) {
    return { message: 'Invalid email or password.' };
  }
  
  const { email, password } = validatedFields.data;

  try {
    const users = await getDistributionUsers();
    const user = users.find((u) => u.email === email);

    if (!user || user.password !== password) {
        return { message: 'Invalid email or password.' };
    }

    await setSession(user.id);
    
  } catch (error) {
    if (error instanceof Error && 'digest' in error && error.digest?.startsWith('NEXT_REDIRECT')) {
        // This is for the redirect error, which we want to throw.
        throw error;
    }
    // This is a generic error, could be anything.
    return { message: 'An unexpected error occurred.' };
  }
  redirect('/');
}
