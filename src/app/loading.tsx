import { Loader2 } from "lucide-react";

/**
 * Root Loading UI - Automatically displayed by Next.js during route transitions.
 * Provides a branded, professional acknowledgement that data is being fetched.
 */
export default function RootLoading() {
  return (
    <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-bold text-foreground">Accessing Site Data...</p>
        <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground animate-pulse">
          Intelligence Hub
        </p>
      </div>
    </div>
  );
}
