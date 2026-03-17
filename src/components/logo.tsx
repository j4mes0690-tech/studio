import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Redesigned to precisely match the provided eagle and hard-hat motif.
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
            viewBox="0 0 1024 1024"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Site Command eagle helmet logo"
          >
            {/* Hard Hat - Stylized Tracing */}
            <path 
              d="M320 420 C320 280 400 220 512 220 C624 220 704 280 704 420" 
              stroke="#f26522" 
              strokeWidth="55" 
              strokeLinecap="round" 
            />
            <path 
              d="M285 435 L739 435 L755 465 L269 465 Z" 
              fill="#f26522" 
            />
            <path 
              d="M400 360 C400 310 450 275 512 275 C574 275 624 310 624 360" 
              stroke="#f26522" 
              strokeWidth="12" 
              strokeLinecap="round" 
              opacity="0.4"
            />

            {/* Stylized Eagle - Lightning Bolt Style */}
            {/* Left Stroke */}
            <path 
              d="M260 560 L480 560 L280 730 L500 730" 
              stroke="#000000" 
              strokeWidth="65" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            {/* Right Stroke / Head / Beak */}
            <path 
              d="M580 510 L720 510 C840 510 860 620 760 650 L550 830" 
              stroke="#000000" 
              strokeWidth="65" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
        )}
      </div>
      {!hideText && (
        <span className="text-2xl font-black tracking-tighter uppercase text-slate-800">
          Site<span className="text-[#f26522]">Command</span>
        </span>
      )}
    </div>
  );
}
