import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_NAME_LENGTH, type Table } from "@athanordb/shared";
import { SettingsIcon } from "../Icons.js";
import { SWATCH_CELL_CLASS, SWATCH_CELL_ACTIVE_CLASS, SWATCH_GRID_CLASS } from "../ColorSwatchPicker.js";
import {
  POPOVER_GROUP_CLASS,
  POPOVER_HEADER_CLASS,
  POPOVER_INPUT_CLASS,
  POPOVER_LABEL_CLASS,
  POPOVER_TITLE_CLASS,
} from "./tableStyles.js";

export const DEFAULT_HEADER_COLOR = "#334155";

/** Table header's gear button — popover to rename the table and pick its header color. */
export function TableSettingsPopover({
  table,
  palette,
  onRename,
  onStyleChange,
  triggerClassName,
}: {
  table: Table;
  palette: string[];
  onRename: (name: string) => void;
  onStyleChange: (color: string | undefined, borderColor: string | undefined) => void;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(table.name);
  const [lastName, setLastName] = useState(table.name);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Re-seed the draft when the table is renamed elsewhere (DBML panel, another
  // user). Adjusted during render rather than in an effect — no extra commit,
  // no flash of the previous name.
  if (table.name !== lastName) {
    setLastName(table.name);
    setNameDraft(table.name);
  }

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (popoverRef.current?.contains(target) || triggerRef.current?.contains(target))) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        x: Math.min(Math.max(10, rect.left), window.innerWidth - 270),
        y: Math.min(rect.bottom + 6, window.innerHeight - 280),
      });
    }
    setOpen((v) => !v);
  };

  const commitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== table.name) {
      onRename(trimmed);
    } else {
      setNameDraft(table.name);
    }
  };

  const currentColor = table.style?.color ?? DEFAULT_HEADER_COLOR;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`nodrag ${triggerClassName}${open ? " has-open-popover" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        data-tooltip="Table settings"
      >
        <SettingsIcon size={13} />
      </button>
      {open &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] flex w-[268px] flex-col gap-3 rounded-lg border border-border-strong bg-surface-raised p-3.5 shadow-lg nodrag"
            style={{ left: popoverPos.x, top: popoverPos.y }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={POPOVER_HEADER_CLASS}>
              <span className={POPOVER_TITLE_CLASS}>Table Settings</span>
            </div>

            <div className={POPOVER_GROUP_CLASS}>
              <label className={POPOVER_LABEL_CLASS}>Table Name</label>
              <input
                className={POPOVER_INPUT_CLASS}
                value={nameDraft}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === "Enter" && commitRename()}
                placeholder="Table name"
              />
            </div>

            <div className={POPOVER_GROUP_CLASS}>
              <label className={POPOVER_LABEL_CLASS}>Header Color</label>
              <div className={`${SWATCH_GRID_CLASS} mt-1`}>
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${SWATCH_CELL_CLASS} ${c.toLowerCase() === currentColor.toLowerCase() ? SWATCH_CELL_ACTIVE_CLASS : ""}`}
                    style={{ background: c }}
                    onClick={() => onStyleChange(c, table.style?.borderColor)}
                    data-tooltip={c}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
