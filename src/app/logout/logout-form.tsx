'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export function LogoutForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      // Clear the custom system session and unique session ID
      localStorage.clear();
      
      // Force a full reload to the login page
      window.location.href = '/login';
    } catch (err: any) {
      console.error('Logout Error:', err);
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
    </div>
  );
}
