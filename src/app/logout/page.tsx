import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function LogoutPage() {
  cookies().delete('userId');
  redirect('/login');
  // Next.js will not render anything below a redirect.
  return null;
}
