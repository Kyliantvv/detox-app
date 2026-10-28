import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 24, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Stroke>
);

export const ReelsIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="m10 8.5 5 3.5-5 3.5z" />
  </Stroke>
);

export const SendIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 3 10 14" />
    <path d="m21 3-7 18-4-7-7-4z" />
  </Stroke>
);

export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Stroke>
);

export const BagIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 8h14l-1 13H6z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Stroke>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Stroke {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />
  </Stroke>
);

export const CommentIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </Stroke>
);

export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Stroke {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </Stroke>
);

export const MoreIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="5" cy="12" r="0.8" fill="currentColor" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    <circle cx="19" cy="12" r="0.8" fill="currentColor" />
  </Stroke>
);

export const MenuIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Stroke>
);

export const GridIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
  </Stroke>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m15 5-7 7 7 7" />
  </Stroke>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m9 5 7 7-7 7" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Stroke>
);

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const ShieldIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" />
  </Stroke>
);

export const EyeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
);

export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Stroke>
);

export const BoltIcon = ({ size = 24, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13.5 2 4 14h6.5L9 22l11-13h-7z" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4s.5 2 2 2c0-3 1.5-6 1.5-8z" />
  </Stroke>
);

// Icônes des articles de L'Épicerie.
export const SugarIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M7 4h10l-1 3H8z" />
    <path d="M8 7h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <path d="M10.5 12h3M10.5 15h3" />
  </Stroke>
);

export const TicketIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3z" transform="translate(0 -1)" />
    <path d="M12 6v2M12 11v2M12 16v1" />
  </Stroke>
);

export const GiftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="4" y="9" width="16" height="12" rx="1" />
    <path d="M3 9h18M12 9v12" />
    <path d="M12 9S10.5 4 8 4.5 7 8.5 12 9zM12 9s1.5-5 4-4.5S17 8.5 12 9z" />
  </Stroke>
);

export const CigaretteIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="14" width="16" height="4" rx="1" />
    <path d="M15 14v4" />
    <path d="M19 8c0-2 2-2 2-4M21 14v4" />
  </Stroke>
);

export const ImageIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Stroke>
);
