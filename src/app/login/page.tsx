
import { HardHat } from 'lucide-react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
            <HardHat className="h-12 w-12 text-primary" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
                Welcome to SiteCommand
            </h1>
            <p className="mt-2 text-muted-foreground">
                Enter your credentials to access your account.
            </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
