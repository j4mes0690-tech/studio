import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Handles the user logout process by clearing the session cookie
 * and redirecting the user to the login page.
 */
export async function GET(request: NextRequest) {
  // Create a response that redirects to the login page.
  const response = NextResponse.redirect(new URL('/login', request.url));

  // Invalidate the session cookie by instructing the browser to delete it.
  response.cookies.delete('userId');

  return response;
}
