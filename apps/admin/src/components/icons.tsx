import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true as const, ...p });

export const IconDashboard = (p: P) => <svg {...base(p)}><path d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z" strokeLinejoin="round" /></svg>;
export const IconNews = (p: P) => <svg {...base(p)}><path d="M4 3h12v14H4z M7 7h6M7 10h6M7 13h4" strokeLinejoin="round" /></svg>;
export const IconFolder = (p: P) => <svg {...base(p)}><path d="M2.5 5.5v10h15v-8h-7l-2-2z" strokeLinejoin="round" /></svg>;
export const IconUsers = (p: P) => <svg {...base(p)}><circle cx="7.5" cy="7" r="3" /><path d="M2 16.5c.8-2.8 3-4 5.5-4s4.7 1.2 5.5 4M13 4.2a3 3 0 0 1 0 5.6M15 12.8c1.4.6 2.4 1.9 3 3.7" /></svg>;
export const IconLog = (p: P) => <svg {...base(p)}><path d="M5 3h10v14H5z M8 7h4M8 10h4M8 13h2" /><circle cx="15" cy="15" r="3" fill="white" /><path d="M15 13.8V15l.9.6" /></svg>;
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M10 4v12M4 10h12" /></svg>;
export const IconLogout = (p: P) => <svg {...base(p)}><path d="M8 4H4v12h4M12 6l4 4-4 4M16 10H8" /></svg>;
export const IconKey = (p: P) => <svg {...base(p)}><circle cx="7" cy="12" r="3.5" /><path d="m9.5 9.5 7-7M14 5l2 2M12 7l1.5 1.5" /></svg>;
export const IconExternal = (p: P) => <svg {...base(p)}><path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4" /></svg>;
export const IconUpload = (p: P) => <svg {...base(p)}><path d="M10 13V3M6 7l4-4 4 4M3 13v4h14v-4" /></svg>;
export const IconTrash = (p: P) => <svg {...base(p)}><path d="M4 6h12M8 6V4h4v2M5.5 6l1 11h7l1-11" /></svg>;
export const IconClose = (p: P) => <svg {...base(p)}><path d="m5 5 10 10M15 5 5 15" /></svg>;
export const IconCheck = (p: P) => <svg {...base(p)}><path d="m4 10.5 4 4 8-9" /></svg>;
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>;
export const IconSearch = (p: P) => <svg {...base(p)}><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>;
export const IconDoc = (p: P) => <svg {...base(p)}><path d="M5 2.5h7l3 3v12H5z M12 2.5v3h3" strokeLinejoin="round" /></svg>;
export const IconArrowLeft = (p: P) => <svg {...base(p)}><path d="M16 10H4M9 5l-5 5 5 5" /></svg>;
