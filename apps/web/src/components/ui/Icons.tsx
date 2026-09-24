import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps, viewBox = '0 0 16 16') => ({
  viewBox,
  'aria-hidden': true as const,
  focusable: false as const,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  ...props,
});

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" /></svg>
);
export const ArrowUpRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 12 12 4M5.5 4H12v6.5" /></svg>
);
export const ArrowLeft = (p: IconProps) => (
  <svg {...base(p)}><path d="M13.5 8h-11M7 3.5 2.5 8 7 12.5" /></svg>
);
export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}><path d="m4 6 4 4 4-4" /></svg>
);
export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
);
export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3.5 10.5 8 6 12.5" /></svg>
);
export const Mail = (p: IconProps) => (
  <svg {...base(p)}><rect x="1.5" y="3.5" width="13" height="9" /><path d="m2 4 6 5 6-5" /></svg>
);
export const Phone = (p: IconProps) => (
  <svg {...base(p)}><path d="M4.5 1.8 6.3 5 5 6.4a8.5 8.5 0 0 0 4.6 4.6L11 9.7l3.2 1.8-.6 2.2c-.2.6-.8 1-1.4.9C6.6 14 2 9.4 1.4 3.8c-.1-.6.3-1.2.9-1.4z" strokeLinejoin="round" /></svg>
);
export const MapPin = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 14.5s5-4.6 5-8.3A5 5 0 0 0 3 6.2c0 3.7 5 8.3 5 8.3z" /><circle cx="8" cy="6.3" r="1.8" /></svg>
);
export const Search = (p: IconProps) => (
  <svg {...base(p, '0 0 20 20')}><circle cx="8.5" cy="8.5" r="5.75" strokeWidth={1.4} /><path d="m13 13 4.5 4.5" strokeWidth={1.4} /></svg>
);
export const Lock = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="7" width="10" height="7" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>
);
export const Play = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none"><path d="M4.5 2.5v11L13 8z" /></svg>
);
export const Pause = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.6}><path d="M5 3v10M11 3v10" /></svg>
);
export const Plus = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 2.5v11M2.5 8h11" /></svg>
);
export const Close = (p: IconProps) => (
  <svg {...base(p, '0 0 20 20')}><path d="m4 4 12 12M16 4 4 16" /></svg>
);
export const Document = (p: IconProps) => (
  <svg {...base(p)} strokeWidth={1.1}><path d="M4 1.5h5.5L12.5 4.5v10h-8.5zM9.5 1.5v3h3M6 8h4.5M6 10.5h4.5" /></svg>
);
export const Calendar = (p: IconProps) => (
  <svg {...base(p)}><rect x="2" y="3" width="12" height="11" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
);
export const Download = (p: IconProps) => (
  <svg {...base(p)}><path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11" /></svg>
);

/* Réseaux sociaux (pleins) */
const solid = (p: IconProps) => ({ ...base(p), fill: 'currentColor', stroke: 'none' });
export const socialIcons = {
  facebook: (p: IconProps) => (
    <svg {...solid(p)}><path d="M9 14V8.6h1.8l.3-2.1H9V5.2c0-.6.2-1 1-1h1.1V2.4c-.2 0-.9-.1-1.6-.1C7.9 2.3 7 3.3 7 5v1.5H5.2v2.1H7V14z" /></svg>
  ),
  twitter: (p: IconProps) => (
    <svg {...base(p)}><path d="M2.6 2.5h3.1l7.7 11H10.3zM13 2.5 9.1 7M6.9 9l-4 4.5" /></svg>
  ),
  linkedin: (p: IconProps) => (
    <svg {...solid(p)}><rect x="2.5" y="6" width="2.2" height="7.5" /><circle cx="3.6" cy="3.6" r="1.3" /><path d="M6.8 6h2.1v1.1c.4-.7 1.2-1.3 2.4-1.3 2 0 2.4 1.3 2.4 3v4.7h-2.2V9.4c0-1-.1-1.8-1.1-1.8s-1.4.8-1.4 1.8v4.1H6.8z" /></svg>
  ),
  youtube: (p: IconProps) => (
    <svg {...base(p)}><rect x="1.5" y="3.5" width="13" height="9" rx="2" /><path d="m6.8 6 3.4 2-3.4 2z" fill="currentColor" /></svg>
  ),
  instagram: (p: IconProps) => (
    <svg {...base(p)}><rect x="2" y="2" width="12" height="12" rx="3.5" /><circle cx="8" cy="8" r="2.7" /><circle cx="11.6" cy="4.4" r=".6" fill="currentColor" /></svg>
  ),
} as const;

/* Services (trait fin, 24px) */
const service = (p: IconProps) => ({ ...base(p, '0 0 24 24'), strokeWidth: 1.2 });
export const serviceIcons = {
  portal: (p: IconProps) => (
    <svg {...service(p)}><rect x="3" y="4" width="18" height="13" /><path d="M8 20.5h8M12 17v3.5M7 9h6M7 12h10" /></svg>
  ),
  apply: (p: IconProps) => (
    <svg {...service(p)}><path d="M14 3H6v18h12V7z M14 3v4h4M9 13l2 2 4-4" /></svg>
  ),
  chart: (p: IconProps) => (
    <svg {...service(p)}><path d="M4 20V11M9.5 20V5M15 20v-7M20.5 20V8M2.5 21.5h20" /></svg>
  ),
  document: (p: IconProps) => (
    <svg {...service(p)}><path d="M6 3h8l4 4v14H6z M14 3v4h4M9 12h6M9 15h6M9 18h4" /></svg>
  ),
  exam: (p: IconProps) => (
    <svg {...service(p)}><path d="M4.5 3.5h15v17h-15z M8 9l1.5 1.5 3-3M8 15.5l1.5 1.5 3-3M15 9h1.5M15 15.5h1.5" /></svg>
  ),
  graduate: (p: IconProps) => (
    <svg {...service(p)} strokeLinejoin="round"><path d="m12 4.5 10 4.8-10 4.8L2 9.3z M6.5 11.5v5c1.5 1.6 3.5 2.4 5.5 2.4s4-.8 5.5-2.4v-5M22 9.3v6" /></svg>
  ),
  info: (p: IconProps) => (
    <svg {...service(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v1" /></svg>
  ),
} as const;
