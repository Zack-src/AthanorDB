import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Field } from "@athanordb/shared";
import { DiamondIcon, KeyIcon, PencilIcon, TrashIcon } from "../Icons.js";

const COMMON_TYPES = ["int", "varchar", "text", "boolean", "timestamp", "uuid", "json", "decimal", "bigint"];

/** Column's pencil button — popover to edit name/type/default/note and toggle pk/unique/notNull/increment. */
export function FieldEditorPopover({
  field,
  onUpdateField,
  onDeleteField,
  triggerClassName,
}: {
  field: Field;
  onUpdateField?: (fieldId: string, updates: Partial<Field>) => void;
  onDeleteField?: (fieldId: string) => void;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(field.name);
  const [typeDraft, setTypeDraft] = useState(field.type);
  const [defaultDraft, setDefaultDraft] = useState(field.default ?? "");
  const [noteDraft, setNoteDraft] = useState(field.note ?? "");
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNameDraft(field.name);
    setTypeDraft(field.type);
    setDefaultDraft(field.default ?? "");
    setNoteDraft(field.note ?? "");
  }, [field]);

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
        x: Math.min(Math.max(10, rect.left), window.innerWidth - 320),
        y: Math.min(rect.bottom + 6, window.innerHeight - 380),
      });
    }
    setOpen((v) => !v);
  };

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== field.name) {
      onUpdateField?.(field.id, { name: trimmed });
    } else {
      setNameDraft(field.name);
    }
  };

  const commitType = (val?: string) => {
    const next = (val ?? typeDraft).trim();
    if (next && next !== field.type) {
      onUpdateField?.(field.id, { type: next });
    } else {
      setTypeDraft(field.type);
    }
  };

  const commitDefault = () => {
    const trimmed = defaultDraft.trim();
    if (trimmed !== (field.default ?? "")) {
      onUpdateField?.(field.id, { default: trimmed || undefined });
    }
  };

  const commitNote = () => {
    const trimmed = noteDraft.trim();
    if (trimmed !== (field.note ?? "")) {
      onUpdateField?.(field.id, { note: trimmed || undefined });
    }
  };

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
        data-tooltip="Edit column properties"
      >
        <PencilIcon size={11} />
      </button>
      {open &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="field-popover nodrag"
            style={{ left: popoverPos.x, top: popoverPos.y }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="field-popover-header">
              <span className="field-popover-title">Column Properties</span>
              <button
                type="button"
                className="btn btn-icon btn-danger-ghost btn-xs"
                onClick={() => {
                  onDeleteField?.(field.id);
                  setOpen(false);
                }}
                data-tooltip="Delete column"
              >
                <TrashIcon size={13} />
              </button>
            </div>

            <div className="field-popover-group">
              <label className="field-popover-label">Column Name</label>
              <input
                className="input field-popover-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && commitName()}
                placeholder="Column name"
              />
            </div>

            <div className="field-popover-group">
              <label className="field-popover-label">Data Type</label>
              <input
                className="input field-popover-input"
                value={typeDraft}
                onChange={(e) => setTypeDraft(e.target.value)}
                onBlur={() => commitType()}
                onKeyDown={(e) => e.key === "Enter" && commitType()}
                placeholder="e.g. int, varchar"
              />
              <div className="field-popover-type-chips">
                {COMMON_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`field-type-chip${field.type === t ? " field-type-chip-active" : ""}`}
                    onClick={() => {
                      setTypeDraft(t);
                      commitType(t);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-popover-group">
              <label className="field-popover-label">Keywords & Attributes</label>
              <div className="field-popover-kw-grid">
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-pk${field.pk ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { pk: !field.pk })}
                  data-tooltip="Primary Key (pk)"
                >
                  <KeyIcon size={12} /> Primary Key
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-unique${field.unique ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { unique: !field.unique })}
                  data-tooltip="Unique (unique)"
                >
                  <DiamondIcon size={10} /> Unique
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-notnull${field.notNull ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { notNull: !field.notNull })}
                  data-tooltip="Not Null (notNull)"
                >
                  Not Null
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-increment${field.increment ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { increment: !field.increment })}
                  data-tooltip="Auto Increment (increment)"
                >
                  Increment
                </button>
              </div>
            </div>

            <div className="field-popover-group">
              <label className="field-popover-label">Default Value</label>
              <input
                className="input field-popover-input"
                value={defaultDraft}
                onChange={(e) => setDefaultDraft(e.target.value)}
                onBlur={commitDefault}
                onKeyDown={(e) => e.key === "Enter" && commitDefault()}
                placeholder="e.g. now(), 0, 'active'"
              />
            </div>

            <div className="field-popover-group">
              <label className="field-popover-label">Note / Description</label>
              <input
                className="input field-popover-input"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={commitNote}
                onKeyDown={(e) => e.key === "Enter" && commitNote()}
                placeholder="Description"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
