import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features an industrial hexagonal shield with a hard hat crown and stylized 'SC' initials.
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
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Industrial Hexagonal Shield - Dark Slate Base */}
          <path
            d="M50 5 L90 25 V75 L50 95 L10 75 V25 L50 5Z"
            fill="#1e293b" // slate-800
          />
          
          {/* Hard Hat Crown / Top Accent - High-Vis Orange */}
          <path
            d="M50 5 L90 25 H10 L50 5Z"
            fill="#f97316" // orange-500
          />
          
          {/* Stylized Interlocking 'S' and 'C' - High Contrast White */}
          {/* 'S' Part */}
          <path
            d="M32 42 C32 38 35 36 40 36 H48 V42 H40 C38 42 37 43 37 44 C37 45 38 46 40 46 H48 C53 46 56 49 56 54 C56 59 53 62 48 62 H35 V56 H48 C50 56 51 55 51 54 C51 53 50 52 48 52 H40 C35 52 32 49 32 44 V42 Z"
            fill="white"
          />
          
          {/* 'C' Part */}
          <path
            d="M68 41 V36 H52 V62 H68 V57 H58 V41 H68 Z"
            fill="white"
          />

          {/* Optional: Subtle Bottom Reflection / Accent */}
          <path
            d="M50 95 L10 75 L15 72 L50 90 L85 72 L90 75 L50 95 Z"
            fill="white"
            fillOpacity="0.05"
          />
        </svg>
      </div>
      {!hideText && (
        <span className="text-xl font-black tracking-tighter uppercase text-slate-800">
          Site<span className="text-orange-600">Command</span>
        </span>
      )}
    </div>
  );
}
