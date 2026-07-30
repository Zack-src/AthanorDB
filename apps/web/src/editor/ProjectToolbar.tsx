import type { DetailLevel } from "@athanordb/shared";
import { DisplayNameField } from "../DisplayNameField.js";
import { PresenceList } from "../PresenceList.js";
import { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP } from "../localPrefs.js";
import type { AwarenessState } from "../yjsClient.js";
import { Button } from "../ui/Button.js";
import { BrandMark } from "../ui/BrandMark.js";
import { Badge, CountBadge } from "../ui/Badge.js";
import { APP_HEADER, TOOLBAR_DIVIDER, TOOLBAR_GROUP, TOOLBAR_SPACER } from "../ui/layout.js";
import {
  ChevronLeftIcon,
  ClockIcon,
  DownloadIcon,
  LayoutGridIcon,
  RedoIcon,
  RestoreIcon,
  ShieldCheckIcon,
  UndoIcon,
  UploadIcon,
} from "../Icons.js";

export interface ProjectToolbarProps {
  projectName: string;
  viewOnly: boolean;
  connected: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  activeDetailLevel: DetailLevel | null;
  onSetDetailLevel: (level: DetailLevel) => void;
  fontScale: number;
  onAdjustFontScale: (delta: number) => void;
  onShowImport: () => void;
  onShowExport: () => void;
  onShowHistory: () => void;
  onResetLinks: () => void;
  onShowValidation: () => void;
  validationCount: number;
  hasValidationErrors: boolean;
  localUser: string;
  localColor: string;
  remoteAwareness: Map<number, AwarenessState>;
  onDisplayNameChange: (name: string) => void;
}

/** Project-editor header: back/undo/redo/layout, detail-level + font-scale controls, import/export/history/validate, presence + display name. */
export function ProjectToolbar(props: ProjectToolbarProps) {
  return (
    <header className={APP_HEADER}>
      <Button variant="ghost" size="icon" onClick={props.onBack} data-tooltip="Back to projects" data-tooltip-pos="bottom">
        <ChevronLeftIcon size={16} />
      </Button>
      <BrandMark size={24} iconSize={13} />
      <span className="mr-1.5 whitespace-nowrap text-[13.5px] font-semibold">{props.projectName}</span>
      {props.viewOnly && <Badge tone="muted" className="ml-2">View only</Badge>}
      <span className={TOOLBAR_DIVIDER} />
      <div className={TOOLBAR_GROUP}>
        <Button size="icon" onClick={props.onUndo} data-tooltip="Undo (Ctrl+Z)" data-tooltip-pos="bottom">
          <UndoIcon />
        </Button>
        <Button size="icon" onClick={props.onRedo} data-tooltip="Redo (Ctrl+Shift+Z)" data-tooltip-pos="bottom">
          <RedoIcon />
        </Button>
        <Button size="icon" onClick={props.onAutoLayout} data-tooltip="Auto-layout (dagre)" data-tooltip-pos="bottom">
          <LayoutGridIcon size={14} />
        </Button>
      </div>
      <span className={TOOLBAR_DIVIDER} />
      <div className={TOOLBAR_GROUP}>
        <Button
          size="sm"
          active={props.activeDetailLevel === "compact"}
          onClick={() => props.onSetDetailLevel("compact")}
          data-tooltip="Show only key fields"
          data-tooltip-pos="bottom"
        >
          Compact
        </Button>
        <Button
          size="sm"
          active={props.activeDetailLevel === "standard"}
          onClick={() => props.onSetDetailLevel("standard")}
          data-tooltip="Show primary/foreign keys"
          data-tooltip-pos="bottom"
        >
          Standard
        </Button>
        <Button
          size="sm"
          active={props.activeDetailLevel === "full"}
          onClick={() => props.onSetDetailLevel("full")}
          data-tooltip="Show all fields"
          data-tooltip-pos="bottom"
        >
          Full
        </Button>
      </div>
      <span className={TOOLBAR_DIVIDER} />
      <div className="flex items-center gap-0.5" data-tooltip="Canvas text size" data-tooltip-pos="bottom">
        <Button
          size="icon"
          onClick={() => props.onAdjustFontScale(-FONT_SCALE_STEP)}
          disabled={props.fontScale <= FONT_SCALE_MIN}
          data-tooltip="Decrease canvas text size"
          data-tooltip-pos="bottom"
        >
          <span className="text-[11px] font-bold leading-none">A</span>
        </Button>
        <span className="min-w-[34px] text-center text-[11.5px] text-text-muted">{Math.round(props.fontScale * 100)}%</span>
        <Button
          size="icon"
          onClick={() => props.onAdjustFontScale(FONT_SCALE_STEP)}
          disabled={props.fontScale >= FONT_SCALE_MAX}
          data-tooltip="Increase canvas text size"
          data-tooltip-pos="bottom"
        >
          <span className="text-base font-bold leading-none">A</span>
        </Button>
      </div>
      <span className={TOOLBAR_SPACER} />
      <div className={TOOLBAR_GROUP}>
        <Button size="sm" onClick={props.onShowImport}>
          <UploadIcon size={13} /> Import
        </Button>
        <Button size="sm" onClick={props.onShowExport}>
          <DownloadIcon size={13} /> Export
        </Button>
        <Button size="sm" onClick={props.onShowHistory}>
          <ClockIcon size={13} /> History
        </Button>
        <Button
          size="sm"
          onClick={props.onResetLinks}
          data-tooltip="Réinitialise le tracé de tous les liens (retire les points de routage manuels)"
          data-tooltip-pos="bottom"
        >
          <RestoreIcon size={13} /> Reset links
        </Button>
        <Button size="sm" onClick={props.onShowValidation}>
          <ShieldCheckIcon size={13} /> Validate
          {props.validationCount > 0 && <CountBadge count={props.validationCount} danger={props.hasValidationErrors} />}
        </Button>
      </div>
      <span className={TOOLBAR_DIVIDER} />
      <PresenceList localName={props.localUser} localColor={props.localColor} remote={props.remoteAwareness} />
      <DisplayNameField value={props.localUser} onCommit={props.onDisplayNameChange} />
      {!props.connected && <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">connecting…</span>}
    </header>
  );
}
