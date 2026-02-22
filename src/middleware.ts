
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login'];

  // If the user is logged in and is trying to access the login page,
  // redirect them to the dashboard.
  if (userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If the user is not logged in and is trying to access a protected route,
  // redirect them to the login page.
  if (!userId && !publicPaths.includes(pathname)) {
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
