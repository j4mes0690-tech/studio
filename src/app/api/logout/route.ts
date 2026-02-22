import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Handles the user logout process by clearing the session cookie
 * and redirecting the user to the login page.
 */
export async function POST(request: NextRequest) {
  // Create a response that redirects to the login page.
  // Using 303 See Other is the standard for redirecting after a POST.
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });

  // Invalidate the session cookie by instructing the browser to delete it.
  response.cookies.delete('userId');

  return response;
}
