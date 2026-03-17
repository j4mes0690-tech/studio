import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Redesigned to exactly match the provided eagle-head and hard-hat motif.
 */
export function Logo({ 
  className, 
  iconClassName, 
  hideText = false,
  src
}: { 
  className?: string; 
  iconClassName?: string; 
  hideText?: boolean;
  src?: string | null;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative shrink-0 w-10 h-10', iconClassName)}>
        {src ? (
          <img 
            src={src} 
            alt="Company Logo" 
            className="w-full h-full object-contain"
          />
        ) : (
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Eagle Head - Stylized Bolt Strokes (Black) */}
            <path 
              d="M20 75 L45 68 L35 85 L60 78 L50 95 L75 88" 
              stroke="#111827" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M55 60 C65 55 85 55 90 70 C90 80 82 88 65 88 L50 95" 
              stroke="#111827" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M55 75 L65 82 L50 95" 
              stroke="#111827" 
              strokeWidth="6" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            
            {/* Hard Hat Section (Orange) */}
            <path 
              d="M28 55 C28 35 45 30 50 30 C55 30 72 35 72 55" 
              stroke="#f97316" 
              strokeWidth="8" 
              strokeLinecap="round" 
            />
            <path 
              d="M22 58 H78" 
              stroke="#f97316" 
              strokeWidth="6" 
              strokeLinecap="round" 
            />
            
            {/* Hard Hat Detail/Highlights */}
            <path 
              d="M38 42 C42 38 58 38 62 42" 
              stroke="white" 
              strokeWidth="2" 
              strokeLinecap="round" 
              opacity="0.3"
            />
            <path 
              d="M32 55 L45 55" 
              stroke="white" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              opacity="0.2"
            />
          </svg>
        )}
      </div>
      {!hideText && (
        <span className="text-2xl font-black tracking-tighter uppercase text-slate-800">
          Site<span className="text-orange-600">Command</span>
        </span>
      )}
    </div>
  );
}
