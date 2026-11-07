// Minimal inline icon set (stroke-based, 24px viewBox) — no icon-font dependency.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const I = ({ size = 18, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconDashboard = (p) => (
  <I {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></I>
);
export const IconOrders = (p) => (
  <I {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></I>
);
export const IconPalette = (p) => (
  <I {...p}><path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3 3h-2.6a2.4 2.4 0 0 0-1.8 4c.6.7.1 3-2.6 3Z" /><circle cx="7.5" cy="11.5" r="0.5" /><circle cx="11" cy="7.5" r="0.5" /><circle cx="16" cy="9.5" r="0.5" /></I>
);
export const IconTruck = (p) => (
  <I {...p}><path d="M1 5h13v11H1z" /><path d="M14 8h4l4 4v4h-8" /><circle cx="6" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" /></I>
);
export const IconSearch = (p) => (
  <I {...p} size={p.size ?? 16}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>
);
export const IconMenu = (p) => (
  <I {...p} size={p.size ?? 20}><path d="M4 6h16M4 12h16M4 18h16" /></I>
);
export const IconX = (p) => (
  <I {...p} size={p.size ?? 18}><path d="M6 6l12 12M18 6 6 18" /></I>
);
export const IconSun = (p) => (
  <I {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></I>
);
export const IconMoon = (p) => (
  <I {...p}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></I>
);
export const IconLogout = (p) => (
  <I {...p} size={p.size ?? 16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></I>
);
export const IconCopy = (p) => (
  <I {...p} size={p.size ?? 14}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>
);
export const IconCheck = (p) => (
  <I {...p} size={p.size ?? 14}><path d="m4 12.5 5 5L20 6.5" /></I>
);
export const IconChevronL = (p) => (
  <I {...p} size={p.size ?? 16}><path d="m14 6-6 6 6 6" /></I>
);
export const IconChevronR = (p) => (
  <I {...p} size={p.size ?? 16}><path d="m10 6 6 6-6 6" /></I>
);
export const IconPhone = (p) => (
  <I {...p} size={p.size ?? 15}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z" /></I>
);
export const IconExternal = (p) => (
  <I {...p} size={p.size ?? 14}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></I>
);
export const IconMusic = (p) => (
  <I {...p} size={p.size ?? 15}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></I>
);
export const IconDownload = (p) => (
  <I {...p} size={p.size ?? 15}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></I>
);
export const IconPlus = (p) => (
  <I {...p} size={p.size ?? 16}><path d="M12 5v14M5 12h14" /></I>
);
export const IconUser = (p) => (
  <I {...p} size={p.size ?? 16}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></I>
);
export const IconInbox = (p) => (
  <I {...p} size={p.size ?? 32}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6L18.5 5a2 2 0 0 0-1.8-1H7.3a2 2 0 0 0-1.8 1Z" /></I>
);
export const IconRefresh = (p) => (
  <I {...p} size={p.size ?? 15}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></I>
);
export const IconGear = (p) => (
  <I {...p} size={p.size ?? 16}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></I>
);
export const IconShield = (p) => (
  <I {...p} size={p.size ?? 16}><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 11.5 2 2 4-4.5" /></I>
);
export const IconBox = (p) => (
  <I {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></I>
);
export const IconBrush = (p) => (
  <I {...p}><path d="M9.06 11.9 19.2 1.8a2.1 2.1 0 0 1 3 3L12.1 14.94" /><path d="M7.5 13.5c-2 0-3.5 1.6-3.5 3.5 0 1.2-.8 2.2-2 2.5 1 1.5 2.7 2.5 4.5 2.5a5 5 0 0 0 5-5c0-1.9-1.6-3.5-4-3.5Z" /></I>
);
export const IconMoney = (p) => (
  <I {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></I>
);
export const IconKey = (p) => (
  <I {...p} size={p.size ?? 18}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8-8" /><path d="m17 4 3 3M14 7l2.5 2.5" /></I>
);
export const IconTag = (p) => (
  <I {...p} size={p.size ?? 18}><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.3" /></I>
);
export const IconWhatsapp = (p) => (
  <I {...p} size={p.size ?? 15}><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z" /><path d="M8.5 9.5c0 4 6 6.5 6.5 6l1-1.5-2.3-1.3-.9.7c-1.2-.5-2.4-1.7-2.8-2.8l.7-.9L9.5 7.5 8.5 8.4Z" strokeWidth="1.4" /></I>
);
