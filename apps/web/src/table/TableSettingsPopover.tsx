import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Table } from "@athanordb/shared";
import { SettingsIcon } from "../Icons.js";

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
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameDraft(table.name);
  }, [table.name]);

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
            className="table-settings-popover nodrag"
            style={{ left: popoverPos.x, top: popoverPos.y }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="table-settings-header">
              <span className="table-settings-title">Table Settings</span>
            </div>

            <div className="table-settings-group">
              <label className="table-settings-label">Table Name</label>
              <input
                className="input table-settings-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === "Enter" && commitRename()}
                placeholder="Table name"
              />
            </div>

            <div className="table-settings-group">
              <label className="table-settings-label">Header Color</label>
              <div className="color-popover-grid" style={{ marginTop: 4 }}>
                {palette.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch-cell${c.toLowerCase() === currentColor.toLowerCase() ? " color-swatch-cell-active" : ""}`}
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
