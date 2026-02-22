
'use client';

import { useUser } from '@/firebase';
import { LoginPage } from '@/app/login/page';
import { Loader2 } from 'lucide-react';

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
