
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session';
 
export async function middleware(request: NextRequest) {
  const currentUser = await getSession();
  const { pathname } = request.nextUrl;

  const isPublicRoute = pathname === '/login';

  if (!currentUser && !isPublicRoute) {
    // Redirect to login if not authenticated and not on a public route
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (currentUser && isPublicRoute) {
    // Redirect to home if authenticated and trying to access login page
    return NextResponse.redirect(new URL('/', request.url));
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
