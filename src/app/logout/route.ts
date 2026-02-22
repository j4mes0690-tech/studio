import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  cookies().delete('userId');
  redirect('/login');
}
