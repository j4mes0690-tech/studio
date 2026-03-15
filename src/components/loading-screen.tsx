'use client';

import { Logo } from '@/components/logo';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

/**
 * LoadingScreen - A professional branded splash screen for the application.
 * Displayed during initial boot and authentication verification.
 * Enforced by AuthBoundary to show for a minimum of 2 seconds.
 */
export function LoadingScreen() {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        // Natural easing for the progress bar
        return prev + (100 - prev) * 0.1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background animate-in fade-in duration-500 overflow-hidden">
      <div className="flex flex-col items-center gap-10 w-full max-w-sm px-6">
        {/* Centered Branded Icon with Glow and Bouncing Animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse scale-150" />
          <div className="relative z-10 animate-bounce">
            <Logo 
              hideText 
              iconClassName="h-20 w-20 text-primary md:h-24 md:w-24" 
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full text-center">
          <h2 className="text-3xl font-bold tracking-tighter text-foreground">SiteCommand</h2>
          <p className="text-[10px] uppercase font-black tracking-[0.4em] text-muted-foreground/50">
            Initializing Secure Link
          </p>
        </div>

        {/* Themed Progress Bar */}
        <div className="w-full max-w-[240px] space-y-3">
          <Progress value={progress} className="h-1 bg-muted" />
          <div className="flex justify-between px-1">
            <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">System Sync</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">v2.4.0</span>
          </div>
        </div>
      </div>

      {/* Decorative localized footer */}
      <div className="absolute bottom-12 flex items-center gap-3">
        <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-ping" />
        <span className="text-[10px] font-semibold text-muted-foreground/60 italic tracking-wide">
          Connecting to project cloud...
        </span>
      </div>
    </div>
  );
}
