'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDistributionUsers } from '@/lib/data';

export async function loginAction(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      redirect('/login?error=Invalid credentials');
    }

    const formattedEmail = email.trim().toLowerCase();
    const users = await getDistributionUsers();
    const user = users.find(u => u.email.toLowerCase() === formattedEmail);

    if (!user || user.password !== password) {
      redirect('/login?error=Invalid email or password');
    }

    cookies().set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
  } catch (error) {
      redirect('/login?error=An unexpected error occurred.');
  }

  redirect('/');
}
