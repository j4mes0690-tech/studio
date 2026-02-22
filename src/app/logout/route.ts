import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
 
export async function GET(request: NextRequest) {
  const options = {
    name: 'userId',
    value: '',
    maxAge: -1,
  }
 
  // The Next.js router cache is not invalidated when using cookies().delete().
  // Setting the cookie with maxAge: -1 is a more reliable way to ensure it's removed.
  cookies().set(options);
  
  const redirectUrl = new URL('/login', request.url);
  
  // Perform a full redirect to clear any client-side state.
  return NextResponse.redirect(redirectUrl, {
    status: 302, // Use 302 for temporary redirect
  });
}
