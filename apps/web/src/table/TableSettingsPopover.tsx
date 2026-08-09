import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_NAME_LENGTH, type Table, type TableIndex } from "@athanordb/shared";
import { KeyIcon, PlusIcon, SettingsIcon, TrashIcon } from "../Icons.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";
import { SWATCH_CELL_CLASS, SWATCH_CELL_ACTIVE_CLASS, SWATCH_GRID_CLASS } from "../ColorSwatchPicker.js";
import {
  POPOVER_GROUP_CLASS,
  POPOVER_HEADER_CLASS,
  POPOVER_INPUT_CLASS,
  POPOVER_LABEL_CLASS,
  POPOVER_TITLE_CLASS,
} from "./tableStyles.js";

export const DEFAULT_HEADER_COLOR = "#334155";

/** Add-index mini-form: pick 2+ columns (1 is just "make this field pk/unique", already covered by the column popover), unique/pk, an optional name. */
function AddIndexForm(props: {
  table: Table;
  onAdd: (fieldIds: string[], opts: { unique?: boolean; pk?: boolean; name?: string }) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [unique, setUnique] = useState(false);
  const [pk, setPk] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const toggleField = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const submit = () => {
    if (selected.length === 0) return;
    props.onAdd(selected, { unique: unique || undefined, pk: pk || undefined, name: nameDraft.trim() || undefined });
    props.onCancel();
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-strong/80 bg-surface p-2.5">
      <label className={POPOVER_LABEL_CLASS}>Columns</label>
      <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
        {props.table.fields.map((f) => (
          <label key={f.id} className="flex items-center gap-1.5 text-xs text-text">
            <input
              type="checkbox"
              className="accent-primary"
              checked={selected.includes(f.id)}
              onChange={() => toggleField(f.id)}
            />
            <span className="font-mono">{f.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-xs text-text">
          <input type="checkbox" className="accent-primary" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          Unique
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text">
          <input type="checkbox" className="accent-primary" checked={pk} onChange={(e) => setPk(e.target.checked)} />
          Primary key
        </label>
      </div>
      <input
        className={POPOVER_INPUT_CLASS}
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        placeholder="Index name (optional)"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={selected.length === 0} onClick={submit}>
          Create
        </Button>
      </div>
    </div>
  );
}

function IndexRow(props: {
  index: TableIndex;
  table: Table;
  onUpdate?: (indexId: string, updates: Partial<Pick<TableIndex, "unique" | "pk" | "name">>) => void;
  onDelete?: (indexId: string) => void;
}) {
  const { index } = props;
  const columnNames = index.fieldIds
    .map((id) => props.table.fields.find((f) => f.id === id)?.name ?? "?")
    .join(", ");
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/70 bg-surface px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text" data-tooltip={columnNames}>
        {columnNames}
      </span>
      {index.pk && (
        <Badge tone="warning" className="shrink-0 inline-flex items-center gap-0.5">
          <KeyIcon size={9} /> PK
        </Badge>
      )}
      <button
        type="button"
        className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
          index.unique ? "bg-primary-light text-primary" : "text-text-muted hover:text-text"
        }`}
        onClick={() => props.onUpdate?.(index.id, { unique: !index.unique })}
        data-tooltip="Toggle unique"
      >
        Uniq
      </button>
      <Button variant="danger-ghost" size="icon" onClick={() => props.onDelete?.(index.id)} data-tooltip="Delete index">
        <TrashIcon size={12} />
      </Button>
    </div>
  );
}

/** Table header's gear button — popover to rename the table, pick its header color, and manage its indexes (including composite/multi-column primary keys). */
export function TableSettingsPopover({
  table,
  palette,
  onRename,
  onStyleChange,
  onAddIndex,
  onUpdateIndex,
  onDeleteIndex,
  triggerClassName,
}: {
  table: Table;
  palette: string[];
  onRename: (name: string) => void;
  onStyleChange: (color: string | undefined, borderColor: string | undefined) => void;
  onAddIndex?: (fieldIds: string[], opts: { unique?: boolean; pk?: boolean; name?: string }) => void;
  onUpdateIndex?: (indexId: string, updates: Partial<Pick<TableIndex, "unique" | "pk" | "name">>) => void;
  onDeleteIndex?: (indexId: string) => void;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(table.name);
  const [lastName, setLastName] = useState(table.name);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [addingIndex, setAddingIndex] = useState(false);

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
      setAddingIndex(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setAddingIndex(false);
      }
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
    } else {
      setAddingIndex(false);
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
            className="fixed z-[9999] flex max-h-[80vh] w-[300px] flex-col gap-3 overflow-y-auto rounded-lg border border-border-strong bg-surface-raised p-3.5 shadow-lg nodrag"
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

            {(onAddIndex || table.indexes.length > 0) && (
              <div className={POPOVER_GROUP_CLASS}>
                <div className="flex items-center justify-between">
                  <label className={POPOVER_LABEL_CLASS}>
                    Indexes {table.indexes.length > 0 && `(${table.indexes.length})`}
                  </label>
                  {onAddIndex && !addingIndex && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover"
                      onClick={() => setAddingIndex(true)}
                    >
                      <PlusIcon size={11} /> Add
                    </button>
                  )}
                </div>

                {table.indexes.length === 0 && !addingIndex && (
                  <p className="text-[11px] italic text-text-muted">
                    No indexes yet — a 2+ column primary key is created here too.
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  {table.indexes.map((idx) => (
                    <IndexRow key={idx.id} index={idx} table={table} onUpdate={onUpdateIndex} onDelete={onDeleteIndex} />
                  ))}
                </div>

                {addingIndex && onAddIndex && (
                  <AddIndexForm table={table} onAdd={onAddIndex} onCancel={() => setAddingIndex(false)} />
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
