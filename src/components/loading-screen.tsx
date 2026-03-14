'use client';

import { Logo } from '@/components/logo';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

/**
 * LoadingScreen - A professional branded splash screen for the application.
 * Displayed during initial boot and authentication verification.
 */
export function LoadingScreen() {
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + (100 - prev) * 0.1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-8 w-full max-w-xs px-6">
        {/* Pulsing Branded Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse scale-150" />
          <Logo className="h-16 w-16 text-primary relative z-10 animate-bounce" />
        </div>

        <div className="flex flex-col items-center gap-2 w-full">
          <h2 className="text-2xl font-bold tracking-tight">SiteCommand</h2>
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground/60">
            Initializing Systems
          </p>
        </div>

        {/* Themed Progress Bar */}
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-1 bg-muted" />
          <div className="flex justify-between px-1">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">Establishing Link</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase">v2.4.0</span>
          </div>
        </div>
      </div>

      {/* Decorative footer */}
      <div className="absolute bottom-10 flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-primary/40 animate-ping" />
        <span className="text-[10px] font-medium text-muted-foreground italic">Connecting to secure site cloud...</span>
      </div>
    </div>
  );
}
