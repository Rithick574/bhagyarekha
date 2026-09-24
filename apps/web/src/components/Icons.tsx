import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function base(props: IconProps) {
  const { title, ...rest } = props;
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
    focusable: false,
    ...rest,
    children: title ? <title>{title}</title> : null,
  };
}

export function InfoIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="12" cy="12" r="10" />
      <path d="M10 9v6M14 9v6" />
    </svg>
  );
}

export function CrossIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <circle cx="12" cy="12" r="10" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  const { children, ...b } = base(props);
  return (
    <svg {...b}>
      {children}
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="#087F75" />
      <path d="M20 44 C24 30 34 22 46 18 C44 32 36 42 22 46 Z" fill="#F5F8FA" />
      <path d="M22 44 C28 36 36 28 44 21" stroke="#087F75" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
