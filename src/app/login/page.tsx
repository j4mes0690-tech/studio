import { LoginForm } from './login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function LoginPage({
    searchParams,
  }: {
    searchParams?: { [key: string]: string | string[] | undefined };
  }) {

  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
            <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm error={error} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
