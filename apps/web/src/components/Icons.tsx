// Small inline icon set (stroke icons, currentColor) — no icon font, works offline.
type P = { className?: string };
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const ListIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} />
  </svg>
);
export const MapIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const SourcesIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);
export const ClockIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const LayersIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);
export const AlertIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
export const ChevronRight = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const BackIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const SearchIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const PinIcon = MapIcon;
export const OfflineIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.4M19 12.9a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01" />
  </svg>
);
export const RefreshIcon = ({ className = 'size-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5" />
  </svg>
);

/** The ClearSignal mark: three ranked bars in band colours. */
export const Logo = ({ className = 'size-7' }: P) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
    <rect width="28" height="28" rx="7" fill="#0f1720" />
    <rect x="6" y="7" width="16" height="3.4" rx="1.7" fill="#0ea657" />
    <rect x="6" y="12.3" width="12" height="3.4" rx="1.7" fill="#f0a020" />
    <rect x="6" y="17.6" width="8" height="3.4" rx="1.7" fill="#b02020" />
  </svg>
);
export const GearIcon = ({ className = 'size-6' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
export const ArrowUp = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
export const ArrowDown = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);
export const DotIcon = ({ className = 'size-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);
