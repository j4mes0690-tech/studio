import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Now supports an optional 'src' prop to display a custom uploaded logo
 * from the system settings.
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
            {/* Minimalist Professional Logo Concept */}
            <path 
              d="M50 5L15 20V50C15 72 50 95 50 95C50 95 85 72 85 50V20L50 5Z" 
              fill="#f97316" 
              fillOpacity="0.1" 
              stroke="#f97316" 
              strokeWidth="2"
            />
            {/* Hard Hat Motif */}
            <path 
              d="M30 45 C30 35 40 30 50 30 C60 30 70 35 70 45" 
              stroke="#f97316" 
              strokeWidth="8" 
              strokeLinecap="round" 
            />
            <path 
              d="M25 48 H75" 
              stroke="#f97316" 
              strokeWidth="6" 
              strokeLinecap="round" 
            />
            {/* Bolt Detail */}
            <path 
              d="M42 58 L58 58 L42 75 L58 75" 
              stroke="black" 
              strokeWidth="6" 
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
