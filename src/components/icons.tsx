import type { ReactNode } from "react";

// One stroke voice for the whole app: 24px grid, 1.75 stroke, round caps.
const paths = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9.25" />
      <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
    </>
  ),
  library: (
    <>
      <rect x="3.5" y="4" width="4.5" height="16" rx="1" />
      <rect x="10" y="4" width="4.5" height="16" rx="1" />
      <path d="m16 5.8 3.4-.9 3.1 14.4-3.4.9L16 5.8Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.75L12 13 3.5 8.25 12 3.5Z" />
      <path d="m3.5 12.25 8.5 4.75 8.5-4.75" />
      <path d="m3.5 16.25 8.5 4.75 8.5-4.75" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 14.5v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.4" />
    </>
  ),
  maximize: (
    <path d="M8.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v2.5M20.5 8.5V6A2.5 2.5 0 0 0 18 3.5h-2.5M3.5 15.5V18A2.5 2.5 0 0 0 6 20.5h2.5M15.5 20.5H18a2.5 2.5 0 0 0 2.5-2.5v-2.5" />
  ),
  minimize: (
    <path d="M8.5 3.5V6A2.5 2.5 0 0 1 6 8.5H3.5M20.5 8.5H18A2.5 2.5 0 0 1 15.5 6V3.5M3.5 15.5H6A2.5 2.5 0 0 1 8.5 18v2.5M15.5 20.5V18a2.5 2.5 0 0 1 2.5-2.5h2.5" />
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  heart: (
    <path d="M19.2 13.6c1.5-1.5 2.8-3.2 2.8-5.3A5.3 5.3 0 0 0 16.7 3c-1.7 0-2.9.5-4.7 2.2C10.2 3.5 9 3 7.3 3A5.3 5.3 0 0 0 2 8.3c0 2.1 1.3 3.8 2.8 5.3L12 20.8l7.2-7.2Z" />
  ),
  check: <path d="M20 6.5 9.5 17 4 11.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  "book-open": (
    <>
      <path d="M12 7.5v13" />
      <path d="M3 18.5V5a1 1 0 0 1 1-1h4.5A3.5 3.5 0 0 1 12 7.5 3.5 3.5 0 0 1 15.5 4H20a1 1 0 0 1 1 1v13.5a1 1 0 0 1-1 1h-5.5A2.5 2.5 0 0 0 12 22a2.5 2.5 0 0 0-2.5-2.5H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  "spacing-snug": <path d="M4 8.5h16M4 12h16M4 15.5h16" />,
  "spacing-normal": <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  "spacing-airy": <path d="M4 4.5h16M4 12h16M4 19.5h16" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, size = 20, className, filled = false }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
