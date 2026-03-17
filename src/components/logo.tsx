import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Recreates the orange hard hat and shield motif with stylized 'SC' initials.
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
          className="w-full h-full drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bottom Dark Slate Shield / Base */}
          <path
            d="M20 62 L50 85 L80 62 V52 H20 V62 Z"
            fill="#334155" // slate-700
          />
          
          {/* Main Orange Hard Hat Shell */}
          <path
            d="M15 52 C15 20 35 12 50 12 C65 12 85 20 85 52 H15 Z"
            fill="#f97316" // orange-500
          />
          
          {/* Hard Hat Brim */}
          <path
            d="M8 52 H92 V58 C92 61 90 63 87 63 H13 C10 63 8 61 8 58 V52 Z"
            fill="#ea580c" // orange-600
          />

          {/* Stylized 'S' Path - Bold White */}
          <path
            d="M30 35 C30 31 33 29 38 29 H45 V34 H38 C36 34 35 35 35 36 C35 37 36 38 38 38 H45 C50 38 53 41 53 46 C53 51 50 54 45 54 H33 V49 H45 C47 49 48 48 48 47 C48 46 47 45 45 45 H38 C33 45 30 42 30 37 V35 Z"
            fill="white"
          />
          
          {/* Stylized 'C' Path - Bold White */}
          <path
            d="M72 34 V29 H57 V54 H72 V49 H63 V34 H72 Z"
            fill="white"
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
