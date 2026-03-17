import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Re-designed to match the eagle-head and hard-hat motif provided.
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
            {/* Hard Hat Section */}
            <path 
              d="M28 42 C28 30 40 25 50 25 C60 25 72 30 72 42" 
              stroke="#f97316" 
              strokeWidth="6" 
              strokeLinecap="round" 
            />
            <path 
              d="M22 45 H78" 
              stroke="#f97316" 
              strokeWidth="5" 
              strokeLinecap="round" 
            />
            <path 
              d="M38 32 C42 29 58 29 62 32" 
              stroke="white" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              opacity="0.4"
            />
            
            {/* Stylized Eagle Head (Lightning/Bolt Style) */}
            <path 
              d="M25 55 L42 50 L35 65 L55 60 L45 78 L65 70" 
              stroke="#111827" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M55 50 C65 45 82 45 85 58 C85 65 78 72 65 72 L50 85" 
              stroke="#111827" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M55 65 L62 72 L50 85" 
              stroke="#111827" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
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
