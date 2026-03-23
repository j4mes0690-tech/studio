import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features a simple orange hard hat.
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
            aria-label="SiteCommand Hard Hat Logo"
          >
            <defs>
              <style>
                {`.helmet { fill: none; stroke: #f26522; stroke-width: 45; stroke-linecap: round; stroke-linejoin: round; }`}
              </style>
            </defs>

            {/* Simple Orange Hard Hat - Brand Color #f26522 */}
            <g transform="translate(0, 60)">
              {/* Shell */}
              <path className="helmet" d="M300 450 C320 320 420 250 512 250 C600 250 700 320 724 450" />
              {/* Rim */}
              <path className="helmet" d="M250 500 L774 500 C810 500 830 520 830 540 L194 540 C194 520 214 500 250 500 Z" />
              {/* Detail line */}
              <path className="helmet" d="M400 380 C430 320 500 290 512 290 C524 290 594 320 624 380" />
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
