import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  cookies().delete('userId');
  redirect('/login');
}
