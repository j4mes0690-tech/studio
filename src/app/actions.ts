'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logout() {
  cookies().set('userId', '', { expires: new Date(0) });
  redirect('/login');
}
