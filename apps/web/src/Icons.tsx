import type { CSSProperties } from "react";

/**
 * Small hand-written inline SVG icon set — replaces emoji throughout the UI
 * (rendering varies by OS/font and reads as unpolished). No icon library
 * dependency: keeps the bundle self-contained and consistent with the
 * project's self-hosted stance (same reasoning as avoiding Monaco's CDN
 * default). Stroke-based, 1.75px, currentColor — style via CSS `color`.
 */

export interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function PlusIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function KeyIcon({ size = 12, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M11 12 20 3M16 8l3-3M20 3l1 1" />
    </svg>
  );
}

export function DiamondIcon({ size = 10, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3 21 12 12 21 3 12Z" />
    </svg>
  );
}

export function TagIcon({ size = 12, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12.59 2.59 20 10v0a2 2 0 0 1 0 2.83l-7.17 7.17a2 2 0 0 1-2.83 0L3 13V3h10Z" />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CloseIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function AlertTriangleIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" />
      <path d="M12 9v4M12 16.5v.01" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5.5" />
    </svg>
  );
}

export function UndoIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M4 10h10a5 5 0 0 1 0 10H8" />
      <path d="M8 5 4 10l4 5" />
    </svg>
  );
}

export function RedoIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M20 10H10a5 5 0 0 0 0 10h6" />
      <path d="m16 5 4 5-4 5" />
    </svg>
  );
}

export function LayoutGridIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function DownloadIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3v13M7 11l5 5 5-5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

export function UploadIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 16V3M7 8l5-5 5 5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

export function CodeIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
    </svg>
  );
}

export function ClockIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4.5" />
    </svg>
  );
}

export function FolderIcon({ size = 18, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function PencilIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function TrashIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ArchiveIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1Z" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function RestoreIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function UsersIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function LogOutIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

export function LogoMarkIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <rect x="3" y="4" width="7" height="6" rx="1.25" />
      <rect x="14" y="14" width="7" height="6" rx="1.25" />
      <path d="M10 7h3a2 2 0 0 1 2 2v6" />
    </svg>
  );
}

export function LinkIcon({ size = 10, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9.5 14.5 14.5 9.5M8 12a3 3 0 0 1 0-4.24l2-2a3 3 0 0 1 4.24 4.24l-1 1" />
      <path d="M16 12a3 3 0 0 1 0 4.24l-2 2a3 3 0 0 1-4.24-4.24l1-1" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function TableIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M9.5 9.5V20" />
    </svg>
  );
}

export function FrameIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3.2 3.2" />
    </svg>
  );
}

export function NoteIcon({ size = 15, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M5 3.5h9.5L19 8v12.5H5V3.5Z" />
      <path d="M14.5 3.5V8H19" />
    </svg>
  );
}

export function CommentIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M4 5h16v10.5H9.5L5 19v-3.5H4Z" />
    </svg>
  );
}

export function SettingsIcon({ size = 13, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

