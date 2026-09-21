import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { filled?: boolean };
const base = (props: P) => ({ fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", ...props });

export const IconSearch = (p: P) => (<svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconCart = (p: P) => (<svg {...base(p)}><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6" /><circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>);
export const IconHeart = ({ filled, ...p }: P) => (<svg {...base(p)} fill={filled ? "currentColor" : "none"}><path d="M12 20.5s-7.5-4.6-9.3-9.6C1.5 7.4 4 4.5 7.2 4.5c1.9 0 3.5 1 4.8 2.7 1.3-1.7 2.9-2.7 4.8-2.7 3.2 0 5.7 2.9 4.5 6.4-1.8 5-9.3 9.6-9.3 9.6Z" /></svg>);
export const IconUser = (p: P) => (<svg {...base(p)}><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c.9-3.6 4-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></svg>);
export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>);
export const IconMenu = (p: P) => (<svg {...base(p)}><path d="M4 7h16M4 12h16M4 17h10" /></svg>);
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconArrowLeft = (p: P) => (<svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const IconArrowRight = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconPlus = (p: P) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconMinus = (p: P) => (<svg {...base(p)}><path d="M5 12h14" /></svg>);
export const IconTrash = (p: P) => (<svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>);
export const IconEye = (p: P) => (<svg {...base(p)}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconBox = (p: P) => (<svg {...base(p)}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>);
export const IconShield = (p: P) => (<svg {...base(p)}><path d="M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IconSpark = (p: P) => (<svg {...base(p)}><path d="M12 3c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8Z" /></svg>);
export const IconLeaf = (p: P) => (<svg {...base(p)}><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" /><path d="M5 19c3-4 6-7 10-10" /></svg>);
export const IconTruck = (p: P) => (<svg {...base(p)}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>);
export const IconInstagram = (p: P) => (<svg {...base(p)}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none" /></svg>);
export const IconTelegram = (p: P) => (<svg {...base(p)}><path d="m21 4-18 7.5 6 2 2 6 3.5-4.5 5 3.5L21 4Z" /><path d="m9 13.5 9-7.5" /></svg>);
export const IconLamp = (p: P) => (<svg {...base(p)}><path d="M8 3h8l3 8H5l3-8ZM12 11v7M8 21h8" /></svg>);
export const IconVase = (p: P) => (<svg {...base(p)}><path d="M9 3h6l-1 3c3 2 4 5 4 8a6 6 0 0 1-12 0c0-3 1-6 4-8L9 3Z" /></svg>);
export const IconStand = (p: P) => (<svg {...base(p)}><rect x="7" y="3" width="10" height="14" rx="2" /><path d="M4 21h16M12 17v4" /></svg>);
export const IconGamepad = (p: P) => (<svg {...base(p)}><path d="M6 8h12a4 4 0 0 1 4 4v2.5a3.5 3.5 0 0 1-6.3 2.1L15 15H9l-.7 1.6A3.5 3.5 0 0 1 2 14.5V12a4 4 0 0 1 4-4Z" /><path d="M8 11v3M6.5 12.5h3M16 12h.01M18 13.5h.01" /></svg>);
export const IconFigure = (p: P) => (<svg {...base(p)}><circle cx="12" cy="5" r="2.5" /><path d="M6 10h12M12 10v6M9 21l3-5 3 5" /></svg>);
export const IconFilter = (p: P) => (<svg {...base(p)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>);
export const IconLock = (p: P) => (<svg {...base(p)}><rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>);
export const IconLogout = (p: P) => (<svg {...base(p)}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h10" /></svg>);
export const IconPin = (p: P) => (<svg {...base(p)}><path d="M12 21s-6-5.3-6-10.5a6 6 0 0 1 12 0C18 15.7 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.2" /></svg>);
export const IconBell = (p: P) => (<svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" /></svg>);
export const IconChart = (p: P) => (<svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>);
export const IconGrid = (p: P) => (<svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>);
export const IconTag = (p: P) => (<svg {...base(p)}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.2" /></svg>);
export const IconUsers = (p: P) => (<svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c.7-3 3.3-4.8 6.5-4.8s5.8 1.8 6.5 4.8M16 5a3 3 0 0 1 0 6M18 14.5c2 .6 3.3 2 3.7 4.5" /></svg>);
export const IconSettings = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>);
export const IconList = (p: P) => (<svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
export const IconStar = (p: P) => (<svg {...base(p)}><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z" /></svg>);
export const IconActivity = (p: P) => (<svg {...base(p)}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>);
export const IconKey = (p: P) => (<svg {...base(p)}><circle cx="8" cy="14" r="4.5" /><path d="m11.5 10.5 8-8M17 5l2.5 2.5M14.5 7.5 17 10" /></svg>);
export const IconUpload = (p: P) => (<svg {...base(p)}><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>);

export const CATEGORY_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  figure: IconFigure, vase: IconVase, lamp: IconLamp, stand: IconStand, gamepad: IconGamepad, spark: IconSpark, leaf: IconLeaf, box: IconBox,
};

export function LeafBlob(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 200" fill="currentColor" aria-hidden {...props}>
      <path d="M100 195C42 160 20 110 38 55 88 28 148 38 172 88c18 44-14 92-72 107Z" />
    </svg>
  );
}
