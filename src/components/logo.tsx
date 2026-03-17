import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features a bold, structural monogram where 'S' and 'C' interlock 
 * to form a solid architectural unit.
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
          {/* Background Square with rounded corners - Industrial Feel */}
          <rect width="100" height="100" rx="16" fill="#1e293b" />
          
          {/* Stylized 'C' - Deep Slate / White Border */}
          <path
            d="M75 30 C75 25 70 22 65 22 H35 C30 22 25 25 25 30 V70 C25 75 30 78 35 78 H65 C70 78 75 75 75 70 V62 H65 V70 H35 V30 H65 V38 H75 V30 Z"
            fill="white"
          />
          
          {/* Stylized 'S' - Command Orange */}
          <path
            d="M35 42 H55 C58 42 60 44 60 47 C60 50 58 52 55 52 H45 C42 52 40 54 40 57 C40 60 42 62 45 62 H65 V54 H45 C42 54 40 52 40 49 C40 46 42 44 45 44 H55 C58 44 60 46 60 49 V51 H70 V47 C70 40 65 36 58 36 H35 V42 Z"
            fill="#f97316"
          />

          {/* Accent Line - High-Vis detail */}
          <rect x="35" y="66" width="30" height="4" rx="2" fill="#f97316" fillOpacity="0.5" />
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
