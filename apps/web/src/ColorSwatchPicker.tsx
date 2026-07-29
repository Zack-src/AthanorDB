import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "./Icons.js";

export const DEFAULT_PALETTE = [
  "#6366f1",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#475569",
  "#f97316",
  "#6b7280",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
  "#f43f5e",
  "#4f46e5",
  "#06b6d4",
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Small circular swatch button that opens a preset-color popover (+ custom
 * hex) instead of the OS native color picker. Portaled to `document.body`
 * since every caller lives inside a React Flow node — nodes clip overflow
 * and get CSS-transformed for pan/zoom, so an absolutely-positioned child
 * popover would either be clipped or scaled/misplaced with the canvas.
 *
 * `palette` is per-project (persisted in the doc's meta map, shared by every
 * table/zone/note picker in that project) rather than a fixed global list —
 * callers fall back to `DEFAULT_PALETTE` when the project hasn't customized
 * one yet. Right-click a swatch to remove it; the "+" cell adds whatever the
 * current value is.
 */
export function ColorSwatchPicker(props: {
  value: string;
  onChange: (color: string) => void;
  palette: string[];
  onPaletteChange: (palette: string[]) => void;
  triggerClassName: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(props.value);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHexDraft(props.value), [props.value]);

  useEffect(() => {
    if (!open) return;
    // "click", not "mousedown": React Flow's pane calls stopPropagation on
    // mousedown for its own pan/drag handling, so a mousedown-based
    // outside-click listener on window never fires for clicks landing on the
    // canvas — only for clicks outside React Flow entirely. Plain "click"
    // isn't intercepted the same way (same reason the canvas context menu's
    // own outside-click handling already uses "click").
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
      setPopoverPos({ x: rect.left, y: rect.bottom + 6 });
    }
    setOpen((v) => !v);
  };

  const commitHex = () => {
    const next = hexDraft.trim();
    if (HEX_RE.test(next)) props.onChange(next);
    else setHexDraft(props.value);
  };

  const removeFromPalette = (e: ReactMouseEvent, color: string) => {
    e.preventDefault();
    props.onPaletteChange(props.palette.filter((c) => c !== color));
  };

  const addCurrentToPalette = () => {
    if (props.palette.some((c) => c.toLowerCase() === props.value.toLowerCase())) return;
    props.onPaletteChange([...props.palette, props.value]);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`nodrag ${props.triggerClassName}`}
        style={{ background: props.value }}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        title={props.title ?? "Color"}
      />
      {open &&
        popoverPos &&
        createPortal(
          <div ref={popoverRef} className="color-popover nodrag" style={{ left: popoverPos.x, top: popoverPos.y }}>
            <div className="color-popover-grid">
              {props.palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch-cell${c.toLowerCase() === props.value.toLowerCase() ? " color-swatch-cell-active" : ""}`}
                  style={{ background: c }}
                  onClick={() => {
                    props.onChange(c);
                    setOpen(false);
                  }}
                  onContextMenu={(e) => removeFromPalette(e, c)}
                  title={`${c} (right-click to remove)`}
                />
              ))}
              <button
                type="button"
                className="color-swatch-cell color-swatch-cell-add"
                onClick={addCurrentToPalette}
                title="Add current color to this project's palette"
              >
                <PlusIcon size={11} />
              </button>
            </div>
            <input
              className="input color-popover-hex-input"
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitHex();
                if (e.key === "Escape") setHexDraft(props.value);
              }}
              spellCheck={false}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
