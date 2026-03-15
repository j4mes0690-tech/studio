import { HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Supports hiding text for compact or splash screen use cases.
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
    <div
      className={cn(
        'flex items-center gap-2 text-lg font-extrabold tracking-tighter',
        className
      )}
    >
      <div className="bg-primary p-1.5 rounded-lg shadow-sm">
        <HardHat className={cn('h-5 w-5 text-primary-foreground', iconClassName)} />
      </div>
      {!hideText && <span>SiteCommand</span>}
    </div>
  );
}
