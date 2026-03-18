import { cn } from '@/lib/utils';

/**
 * Logo - The primary branding component for SiteCommand.
 * Updated to use the precise SVG geometry provided by the user.
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
            {/* Hard hat */}
            <path
              d="M365 360 C380 275 450 225 540 225 C620 225 690 268 718 345"
              stroke="#f26522"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M420 320 C450 278 500 255 555 255 C608 255 650 273 684 310"
              stroke="#f26522"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M333 392 L705 392 C733 392 755 403 770 418 L318 418 Z"
              stroke="#f26522"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Eagle */}
            <path
              d="M308 495 L196 574 L385 606 L453 529"
              stroke="#000000"
              strokeWidth="30"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M468 582 C527 520 596 484 672 473 C721 466 764 482 796 515 C823 543 833 580 829 623 C822 697 766 737 710 750"
              stroke="#000000"
              strokeWidth="30"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M648 507 C686 529 711 549 737 584 C703 582 667 575 632 559"
              stroke="#000000"
              strokeWidth="30"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M690 744 C630 727 564 714 494 707 C519 657 556 624 610 596 C659 571 705 563 748 570"
              stroke="#000000"
              strokeWidth="30"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M370 612 C327 653 301 705 285 772 L520 812"
              stroke="#000000"
              strokeWidth="30"
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
