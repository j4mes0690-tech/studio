
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
// Authentication has been temporarily disabled to resolve a critical bug.
export async function middleware(request: NextRequest) {
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
