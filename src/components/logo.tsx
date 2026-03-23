import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features a stylized orange hard hat on an eagle silhouette.
 * Supports an optional 'src' prop for company branding (white-labelling).
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
      <div className={cn(
        'relative shrink-0 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg transition-all border border-muted-foreground/10', 
        iconClassName
      )}>
        {src ? (
          <img 
            src={src} 
            alt="Company Logo" 
            className="w-full h-full object-contain p-1.5"
          />
        ) : (
          <svg 
            viewBox="0 0 1024 1024" 
            className="w-full h-full p-1" 
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="SiteCommand Eagle Logo"
          >
            <defs>
              <style>
                {`.helmet { fill: none; stroke: #f26522; stroke-width: 35; stroke-linecap: round; stroke-linejoin: round; } .eagle { fill: #1e40af; opacity: 0.9; }`}
              </style>
            </defs>

            {/* Eagle Silhouette - Accent Color #1e40af */}
            <g transform="translate(0, 50)">
                {/* Majestic Wings */}
                <path className="eagle" d="M512 450 L100 250 Q 250 600 512 850 Q 774 600 924 250 Z" />
                {/* Eagle Head */}
                <path className="eagle" d="M512 450 L550 360 L512 310 L474 360 Z" />
            </g>

            {/* Hard hat - Brand Orange #f26522 - Positioned on the eagle's head */}
            <g transform="translate(0, 40)">
              <path className="helmet" d="M365 360 C380 275 450 225 540 225 C620 225 690 268 718 345" />
              <path className="helmet" d="M420 320 C450 278 500 255 555 255 C608 255 650 273 684 310" />
              <path className="helmet" d="M333 392 L705 392 C733 392 755 403 770 418 L318 418 Z" />
            </g>
          </svg>
        )}
      </div>
      {!hideText && (
        <span className="text-xl font-bold tracking-tighter uppercase text-slate-800">
          Site<span className="text-primary">Command</span>
        </span>
      )}
    </div>
  );
}
