
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Logging in...' : 'Log In'}
    </Button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  const [state, dispatch] = useFormState(loginAction, undefined);

  // This handles both form validation errors and initial server-side errors passed via search param
  const errorMessage = state?.message || error;

  return (
    <form action={dispatch} className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Login Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="pm@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required defaultValue="password" />
      </div>
      <LoginButton />
    </form>
  );
}
