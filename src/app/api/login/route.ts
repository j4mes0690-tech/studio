import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDistributionUsers } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 400 });
    }

    const formattedEmail = email.trim().toLowerCase();

    const users = await getDistributionUsers();
    const user = users.find(u => u.email.toLowerCase() === formattedEmail);

    if (!user || user.password !== password) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // On success, create a response and set the cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;

  } catch (error) {
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
  }
}
