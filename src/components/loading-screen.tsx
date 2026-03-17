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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background animate-in fade-in duration-1000 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="flex flex-col items-center gap-14 w-full max-w-sm px-6 relative z-10">
        {/* Centered Branded Icon with Bouncing Animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse scale-150" />
          <div className="relative z-10 animate-bounce duration-1000">
            <Logo 
              hideText 
              iconClassName="h-20 w-20 md:h-24 md:w-24 p-1" 
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full text-center border-y border-primary/10 py-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black tracking-tighter text-foreground">SiteCommand</h2>
            <p className="text-[10px] uppercase font-black tracking-[0.6em] text-primary ml-[0.6em]">
              Intelligence Hub
            </p>
          </div>
        </div>

        {/* Themed Progress Bar */}
        <div className="w-full max-w-[280px] space-y-4">
          <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
                className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between px-1">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 animate-pulse">Syncing Site Data</span>
            <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">v2.5.0</span>
          </div>
        </div>
      </div>

      {/* Decorative localised footer */}
      <div className="absolute bottom-12 flex flex-col items-center gap-4">
        <div className="flex gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" />
        </div>
        <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">
          Terminal Initialised
        </span>
      </div>
    </div>
  );
}
