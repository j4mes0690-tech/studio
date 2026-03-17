import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features a modern, stylized hard hat icon representing site safety, 
 * professional execution, and authority in construction management.
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
          {/* Industrial Slate Background Container */}
          <rect width="100" height="100" rx="20" fill="#1e293b" />
          
          {/* Hard Hat Dome - High-Vis Orange */}
          <path 
            d="M22 62 C22 25 78 25 78 62" 
            fill="#f97316" 
          />
          
          {/* Reinforced Brim - High-Vis Orange */}
          <path 
            d="M15 62 H85 C88 62 90 64 90 67 V70 C90 73 88 75 85 75 H15 C12 75 10 73 10 70 V67 C10 64 12 62 15 62 Z" 
            fill="#f97316" 
          />
          
          {/* Central Structural Ridge - White with low opacity */}
          <path 
            d="M44 30 C44 30 50 27 56 30 V62 H44 V30 Z" 
            fill="white" 
            fillOpacity="0.25" 
          />
          
          {/* High-Vis Reflective Strip detail */}
          <rect 
            x="30" 
            y="66" 
            width="40" 
            height="3" 
            rx="1.5" 
            fill="white" 
            fillOpacity="0.4" 
          />
          
          {/* Depth Detail: Brim Shadow */}
          <path 
            d="M22 62 H78" 
            stroke="black" 
            strokeOpacity="0.1" 
            strokeWidth="3" 
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
