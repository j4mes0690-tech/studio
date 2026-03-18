import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Features a stylized orange hard hat over a sharp eagle-head motif.
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
            aria-label="SiteCommand Logo"
          >
            {/* Hard hat */}
            <path 
              fill="none" 
              stroke="#f26522" 
              strokeWidth="28" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M365 360 C380 275 450 225 540 225 C620 225 690 268 718 345" 
            />
            <path 
              fill="none" 
              stroke="#f26522" 
              strokeWidth="28" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M420 320 C450 278 500 255 555 255 C608 255 650 273 684 310" 
            />
            <path 
              fill="none" 
              stroke="#f26522" 
              strokeWidth="28" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M333 392 L705 392 C733 392 755 403 770 418 L318 418 Z" 
            />

            {/* Eagle */}
            <path 
              fill="none" 
              stroke="#000000" 
              strokeWidth="30" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M308 495 L196 574 L385 606 L453 529" 
            />
            <path 
              fill="none" 
              stroke="#000000" 
              strokeWidth="30" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M468 582 C527 520 596 484 672 473 C721 466 764 482 796 515 C823 543 833 580 829 623 C822 697 766 737 710 750" 
            />
            <path 
              fill="none" 
              stroke="#000000" 
              strokeWidth="30" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M648 507 C686 529 711 549 737 584 C703 582 667 575 632 559" 
            />
            <path 
              fill="none" 
              stroke="#000000" 
              strokeWidth="30" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M690 744 C630 727 564 714 494 707 C519 657 556 624 610 596 C659 571 705 563 748 570" 
            />
            <path 
              fill="none" 
              stroke="#000000" 
              strokeWidth="30" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M370 612 C327 653 301 705 285 772 L520 812" 
            />
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
