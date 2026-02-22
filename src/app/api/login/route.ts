import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDistributionUsers } from '@/lib/data';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=Invalid credentials', request.url), { status: 303 });
  }

  const formattedEmail = email.trim().toLowerCase();

  try {
    const users = await getDistributionUsers();
    const user = users.find(u => u.email.toLowerCase() === formattedEmail);

    if (!user || user.password !== password) {
      return NextResponse.redirect(new URL('/login?error=Invalid email or password', request.url), { status: 303 });
    }

    // On success, create a response to redirect to the dashboard
    const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });

    // Set the cookie on the response
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;

  } catch (error) {
    return NextResponse.redirect(new URL('/login?error=An unexpected error occurred', request.url), { status: 303 });
  }
}
