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
