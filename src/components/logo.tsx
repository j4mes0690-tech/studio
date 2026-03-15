import { Building2 } from 'lucide-react';
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
        'flex items-center gap-2 text-lg font-semibold',
        className
      )}
    >
      <Building2 className={cn('h-6 w-6', iconClassName)} />
      {!hideText && <span>SiteCommand</span>}
    </div>
  );
}
