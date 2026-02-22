import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// This is a server component that handles logging the user out.
export default function LogoutPage() {
  // Expire the session cookie.
  cookies().set('userId', '', { expires: new Date(0), path: '/' });
  
  // Redirect to the login page.
  redirect('/login');
}
