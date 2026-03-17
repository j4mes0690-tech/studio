import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Updated to match the new high-performance design: 
 * A stylized hard hat integrated with an eagle/bolt motif.
 */
export function Logo({ 
  className, 
  iconClassName, 
  hideText = false 
}: { 
  className?: string; 
  iconClassName?: string; 
  hideText?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative shrink-0 w-10 h-10', iconClassName)}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hard Hat Dome - High-Vis Orange */}
          <path 
            d="M38 42 C38 30 62 30 62 42" 
            stroke="#f97316" 
            strokeWidth="7" 
            strokeLinecap="round" 
          />
          
          {/* Hard Hat Brim - High-Vis Orange */}
          <path 
            d="M32 46 H68" 
            stroke="#f97316" 
            strokeWidth="5" 
            strokeLinecap="round" 
          />

          {/* Left Graphic Element (Lightning Bolt / Wing) - Black */}
          <path
            d="M24 64 L44 56 L32 70 L52 80"
            stroke="black"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Right Graphic Element (Eagle Head) - Black */}
          <path
            d="M54 66 C62 60 74 62 80 72 C74 72 70 80 62 76"
            stroke="black"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Eagle Eye / Detail Detail - Black */}
          <path
            d="M60 66 C64 62 70 64 74 67"
            stroke="black"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {!hideText && (
        <span className="text-2xl font-black tracking-tighter uppercase text-slate-800">
          Site<span className="text-orange-600">Command</span>
        </span>
      )}
    </div>
  );
}
