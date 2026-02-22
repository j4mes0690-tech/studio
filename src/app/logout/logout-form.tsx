
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export function LogoutForm() {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (!auth) return;
    setIsLoading(true);
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error(err);
      setError('Failed to log out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleLogout} 
        className="w-full" 
        disabled={isLoading} 
        variant="destructive"
      >
        {isLoading ? (
            <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging out...
            </>
        ) : 'Confirm Log Out'}
      </Button>
       <Button variant="outline" asChild className="w-full">
        <Link href="/">Cancel</Link>
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
