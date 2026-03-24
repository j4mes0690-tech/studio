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
      // NUCLEAR WIPE: Clear all local state and session identifiers
      localStorage.clear();
      
      // FORCE FULL RELOAD: Ensure memory is purged and all providers reset
      window.location.assign('/login');
    } catch (err: any) {
      console.error('Logout Exception:', err);
      // Fallback redirect if clear fails
      window.location.assign('/login');
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleLogout} 
        className="w-full h-12 font-bold" 
        disabled={isLoading} 
        variant="destructive"
      >
        {isLoading ? (
            <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ending Session...
            </>
        ) : 'Confirm Log Out'}
      </Button>
       <Button variant="outline" asChild className="w-full h-12 font-bold">
        <Link href="/">Cancel</Link>
      </Button>
    </div>
  );
}
