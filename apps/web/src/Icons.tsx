import type { CSSProperties, FunctionComponent, SVGProps } from "react";

import PlusSvg from "./icons/plus.svg?react";
import KeySvg from "./icons/key.svg?react";
import DiamondSvg from "./icons/diamond.svg?react";
import TagSvg from "./icons/tag.svg?react";
import CloseSvg from "./icons/close.svg?react";
import AlertTriangleSvg from "./icons/alert-triangle.svg?react";
import CheckCircleSvg from "./icons/check-circle.svg?react";
import UndoSvg from "./icons/undo.svg?react";
import RedoSvg from "./icons/redo.svg?react";
import LayoutGridSvg from "./icons/layout-grid.svg?react";
import DownloadSvg from "./icons/download.svg?react";
import UploadSvg from "./icons/upload.svg?react";
import CodeSvg from "./icons/code.svg?react";
import ClockSvg from "./icons/clock.svg?react";
import ShieldCheckSvg from "./icons/shield-check.svg?react";
import FolderSvg from "./icons/folder.svg?react";
import PencilSvg from "./icons/pencil.svg?react";
import TrashSvg from "./icons/trash.svg?react";
import ArchiveSvg from "./icons/archive.svg?react";
import RestoreSvg from "./icons/restore.svg?react";
import UsersSvg from "./icons/users.svg?react";
import LogOutSvg from "./icons/log-out.svg?react";
import ChevronLeftSvg from "./icons/chevron-left.svg?react";
import LogoMarkSvg from "./icons/logo-mark.svg?react";
import LinkSvg from "./icons/link.svg?react";
import ChevronRightSvg from "./icons/chevron-right.svg?react";
import TableSvg from "./icons/table.svg?react";
import FrameSvg from "./icons/frame.svg?react";
import NoteSvg from "./icons/note.svg?react";
import CommentSvg from "./icons/comment.svg?react";
import SettingsSvg from "./icons/settings.svg?react";
import AsteriskSvg from "./icons/asterisk.svg?react";
import IncrementSvg from "./icons/increment.svg?react";
import MinimapSvg from "./icons/minimap.svg?react";
import PuzzleSvg from "./icons/puzzle.svg?react";
import SearchSvg from "./icons/search.svg?react";

/**
 * Icon set — backed by real .svg files under `./icons/` (imported as React
 * components via `vite-plugin-svgr`'s `?react` suffix), not hand-written
 * inline JSX. Kept as one wrapped component per icon, each with its own
 * default `size`, so every call site (`<PlusIcon size={13} />`) is
 * unaffected by the switch — only where the markup lives changed. No icon
 * library dependency: keeps the bundle self-contained and consistent with
 * the project's self-hosted stance (same reasoning as avoiding Monaco's CDN
 * default). Stroke-based, 1.75px, currentColor — style via CSS `color`.
 */

export interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

type SvgComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

function wrap(Svg: SvgComponent, defaultSize: number) {
  return function Icon({ size = defaultSize, style, className }: IconProps) {
    return <Svg width={size} height={size} style={style} className={className} />;
  };
}

export const PlusIcon = wrap(PlusSvg, 16);
export const KeyIcon = wrap(KeySvg, 12);
export const DiamondIcon = wrap(DiamondSvg, 10);
export const TagIcon = wrap(TagSvg, 12);
export const CloseIcon = wrap(CloseSvg, 16);
export const AlertTriangleIcon = wrap(AlertTriangleSvg, 14);
export const CheckCircleIcon = wrap(CheckCircleSvg, 16);
export const UndoIcon = wrap(UndoSvg, 15);
export const RedoIcon = wrap(RedoSvg, 15);
export const LayoutGridIcon = wrap(LayoutGridSvg, 15);
export const DownloadIcon = wrap(DownloadSvg, 15);
export const UploadIcon = wrap(UploadSvg, 15);
export const CodeIcon = wrap(CodeSvg, 15);
export const ClockIcon = wrap(ClockSvg, 15);
export const ShieldCheckIcon = wrap(ShieldCheckSvg, 15);
export const FolderIcon = wrap(FolderSvg, 18);
export const PencilIcon = wrap(PencilSvg, 13);
export const TrashIcon = wrap(TrashSvg, 13);
export const ArchiveIcon = wrap(ArchiveSvg, 13);
export const RestoreIcon = wrap(RestoreSvg, 13);
export const UsersIcon = wrap(UsersSvg, 14);
export const LogOutIcon = wrap(LogOutSvg, 14);
export const ChevronLeftIcon = wrap(ChevronLeftSvg, 16);
export const LogoMarkIcon = wrap(LogoMarkSvg, 15);
export const LinkIcon = wrap(LinkSvg, 10);
export const ChevronRightIcon = wrap(ChevronRightSvg, 16);
export const TableIcon = wrap(TableSvg, 15);
export const FrameIcon = wrap(FrameSvg, 15);
export const NoteIcon = wrap(NoteSvg, 15);
export const CommentIcon = wrap(CommentSvg, 13);
export const SettingsIcon = wrap(SettingsSvg, 13);
export const AsteriskIcon = wrap(AsteriskSvg, 11);
export const IncrementIcon = wrap(IncrementSvg, 11);
export const MinimapIcon = wrap(MinimapSvg, 14);
export const PuzzleIcon = wrap(PuzzleSvg, 14);
export const SearchIcon = wrap(SearchSvg, 14);

export function DatabaseIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function LayersIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function SparklesIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

export function ZapIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function UserIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function PaletteIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.75 1.7-1.68 0-.44-.17-.86-.46-1.18-.28-.31-.45-.73-.45-1.18 0-.93.75-1.69 1.68-1.69h2.36c2.86 0 5.17-2.3 5.17-5.17 0-5.46-4.5-9.93-10-9.93z" />
    </svg>
  );
}

export function SlidersIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function CreditCardIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

export function InfoIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function MousePointerIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="m13 13 6 6" />
    </svg>
  );
}

export function MoveIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  );
}

export function GridIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}


