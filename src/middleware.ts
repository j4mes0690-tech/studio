
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;

  const isPublicPath = request.nextUrl.pathname === '/login';

  if (!userId && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (userId && isPublicPath) {
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
