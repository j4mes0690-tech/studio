import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';

/**
 * Logo - The primary branding component for SiteCommand.
 * Reverted to the original professional building icon.
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
        'relative shrink-0 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg transition-all', 
        iconClassName
      )}>
        {src ? (
          <img 
            src={src} 
            alt="Company Logo" 
            className="w-full h-full object-contain p-1.5"
          />
        ) : (
          <Building2 className="h-6 w-6 text-white" />
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
