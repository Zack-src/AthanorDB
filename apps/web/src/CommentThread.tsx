import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Comment } from "@athanordb/shared";
import { CloseIcon, CommentIcon } from "./Icons.js";

/** "2026-07-29T09:31:59.868Z" -> "2026-07-29 09:31:59" — matches the plain UTC-timestamp style the revision history list already uses. */
function formatTimestamp(iso: string): string {
  return iso.slice(0, 19).replace("T", " ");
}

/**
 * Small comment-thread trigger + popover, used both on a table's header
 * (table-level comments) and on individual field rows (field-level) —
 * same portal-to-`document.body` approach as `ColorSwatchPicker` for the
 * same reason: both live inside a React Flow node, which clips overflow and
 * gets CSS-transformed for pan/zoom.
 */
export function CommentThread(props: {
  comments: Comment[];
  currentUser: string;
  onAdd: (text: string) => void;
  onDelete: (commentId: string) => void;
  triggerClassName: string;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // "click", not "mousedown": React Flow's pane stops mousedown
    // propagation for its own pan/drag handling (same reason
    // ColorSwatchPicker's outside-click detection uses "click" too).
    const onOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("click", onOutsideClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onOutsideClick);
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

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    props.onAdd(text);
    setDraft("");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`nodrag ${props.triggerClassName}${props.comments.length > 0 ? " has-comments" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        data-tooltip={props.tooltip ?? "Comments"}
      >
        <CommentIcon size={12} />
        {props.comments.length > 0 && <span className="comment-count">{props.comments.length}</span>}
      </button>
      {open &&
        popoverPos &&
        createPortal(
          <div ref={popoverRef} className="comment-popover nodrag" style={{ left: popoverPos.x, top: popoverPos.y }}>
            <div className="comment-list">
              {props.comments.length === 0 && <div className="comment-empty">No comments yet.</div>}
              {props.comments.map((c) => (
                <div key={c.id} className="comment-item">
                  <div className="comment-item-head">
                    <span className="comment-item-author">{c.author}</span>
                    <span className="comment-item-time">{formatTimestamp(c.createdAt)}</span>
                    {c.author === props.currentUser && (
                      <button className="comment-item-delete" onClick={() => props.onDelete(c.id)} data-tooltip="Delete comment">
                        <CloseIcon size={11} />
                      </button>
                    )}
                  </div>
                  <div className="comment-item-text">{c.text}</div>
                </div>
              ))}
            </div>
            <div className="comment-compose">
              <textarea
                className="comment-compose-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={!draft.trim()}>
                Post
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
