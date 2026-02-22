'use server';

import { z } from 'zod';
import { getDistributionUsers } from '@/lib/data';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function loginAction(
  formData: FormData
): Promise<FormState> {
  const validatedFields = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    return {
      success: false,
      message: errors.email?.[0] || errors.password?.[0] || 'Invalid data.',
    };
  }

  const { email, password } = validatedFields.data;

  // In a real app, you would have proper authentication logic.
  // Here, we'll just check if the user exists and the password matches the (unhashed) one in our mock data.
  const users = await getDistributionUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return { success: false, message: 'No user found with that email.' };
  }

  // This is NOT secure. For demonstration purposes only.
  if (user.password !== password) {
    return { success: false, message: 'Invalid password.' };
  }
  
  cookies().set('userId', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
  
  // On successful login, redirect the user to the homepage.
  redirect('/');
}
