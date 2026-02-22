
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session';
 
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await getSession();

  // If user is trying to access login page but is already logged in, redirect to home
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is not logged in and is trying to access a protected page, redirect to login
  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
 
  return NextResponse.next();
}
 
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
