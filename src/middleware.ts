
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;
  const { pathname } = request.nextUrl;

  // Allow access to the login page regardless of authentication status.
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // If user is not logged in, redirect them to the login page.
  if (!userId) {
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
