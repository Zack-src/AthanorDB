import { memo, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, useEdges, type Node, type NodeProps } from "@xyflow/react";
import type { Field, Table } from "@athanordb/shared";
import { CommentThread } from "./CommentThread.js";
import { DiamondIcon, KeyIcon, LinkIcon, PencilIcon, PlusIcon, SettingsIcon, TrashIcon } from "./Icons.js";

export interface TableNodeData {
  table: Table;
  /** Field ids that are either endpoint of some ref touching this table — always shown outside compact, even if not PK. */
  refFieldIds: Set<string>;
  highlightLinks?: boolean;
  currentUser: string;
  palette: string[];
  onPaletteChange: (palette: string[]) => void;
  onRename: (name: string) => void;
  onStyleChange: (color: string | undefined, borderColor: string | undefined) => void;
  onAddComment: (text: string, fieldId?: string) => void;
  onDeleteComment: (commentId: string) => void;
  onUpdateField?: (fieldId: string, updates: Partial<Field>) => void;
  onAddField?: (field: Omit<Field, "id">) => void;
  onDeleteField?: (fieldId: string) => void;
  [key: string]: unknown;
}

export type TableNodeType = Node<TableNodeData, "table">;

const DEFAULT_HEADER_COLOR = "#334155";
const COMMON_TYPES = ["int", "varchar", "text", "boolean", "timestamp", "uuid", "json", "decimal", "bigint"];

function FieldBadge({ field, isForeignKey }: { field: Field; isForeignKey: boolean }) {
  if (field.pk) return <KeyIcon className="table-node-row-icon table-node-row-icon-pk" />;
  if (field.unique) return <DiamondIcon className="table-node-row-icon table-node-row-icon-unique" />;
  if (isForeignKey) return <LinkIcon className="table-node-row-icon" />;
  return <span className="table-node-row-icon" />;
}

function TableSettingsPopover({
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
        title="Table settings"
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
                    title={c}
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

function FieldEditorPopover({
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
        title="Edit column properties"
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
                title="Delete column"
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
                  title="Primary Key (pk)"
                >
                  <KeyIcon size={12} /> Primary Key
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-unique${field.unique ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { unique: !field.unique })}
                  title="Unique (unique)"
                >
                  <DiamondIcon size={10} /> Unique
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-notnull${field.notNull ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { notNull: !field.notNull })}
                  title="Not Null (notNull)"
                >
                  Not Null
                </button>
                <button
                  type="button"
                  className={`kw-toggle-btn kw-toggle-increment${field.increment ? " active" : ""}`}
                  onClick={() => onUpdateField?.(field.id, { increment: !field.increment })}
                  title="Auto Increment (increment)"
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

function TableNodeImpl({ data, selected }: NodeProps<TableNodeType>) {
  const { table, refFieldIds } = data;
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(table.name);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const tableComments = table.comments?.filter((c) => !c.fieldId) ?? [];

  const edges = useEdges();
  const selectedEdgeFieldIds = useMemo(() => {
    const set = new Set<string>();
    for (const edge of edges) {
      if (edge.selected && (edge.source === table.id || edge.target === table.id)) {
        if (edge.source === table.id && edge.sourceHandle) {
          set.add(edge.sourceHandle.replace(/-(left|right)-(source|target)$/, ""));
        }
        if (edge.target === table.id && edge.targetHandle) {
          set.add(edge.targetHandle.replace(/-(left|right)-(source|target)$/, ""));
        }
      }
    }
    return set;
  }, [edges, table.id]);

  const rows =
    table.detailLevel === "compact"
      ? []
      : table.detailLevel === "full"
        ? table.fields
        : table.fields.filter((f) => f.pk || refFieldIds.has(f.id));

  const commitRename = () => {
    setRenaming(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== table.name) data.onRename(trimmed);
    else setNameDraft(table.name);
  };

  return (
    <div
      className={`table-node${selected ? " table-node-selected" : ""}`}
      style={{ borderColor: table.style?.borderColor }}
    >
      <div
        className="table-node-header"
        style={{ background: table.style?.color ?? DEFAULT_HEADER_COLOR }}
        onDoubleClick={() => setRenaming(true)}
      >
        <Handle type="target" position={Position.Left} id="header-left-target" style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Left} id="header-left-source" style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Right} id="header-right-target" style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} id="header-right-source" style={{ opacity: 0 }} />
        {renaming ? (
          <input
            autoFocus
            className="nodrag table-node-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setNameDraft(table.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="table-node-name" title="Double-click to rename">
            {table.name}
          </span>
        )}

        <div className="table-node-header-actions">
          <CommentThread
            comments={tableComments}
            currentUser={data.currentUser}
            onAdd={(text) => data.onAddComment(text)}
            onDelete={data.onDeleteComment}
            triggerClassName="table-node-header-btn table-node-comment"
            title="Table comments"
          />
          <TableSettingsPopover
            table={table}
            palette={data.palette}
            onRename={data.onRename}
            onStyleChange={data.onStyleChange}
            triggerClassName="table-node-header-btn table-node-settings"
          />
        </div>
      </div>
      {rows.map((field) => {
        const fieldComments = table.comments?.filter((c) => c.fieldId === field.id) ?? [];
        const isLinked = Boolean(
          (data.highlightLinks && refFieldIds.has(field.id)) ||
          selectedEdgeFieldIds.has(field.id)
        );
        const isSelectedField = selectedFieldId === field.id;

        return (
          <div
            key={field.id}
            className={`table-node-row${isLinked ? " table-node-row-linked" : ""}${isSelectedField ? " table-node-row-selected" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFieldId(field.id);
            }}
          >
            <Handle type="target" position={Position.Left} id={`${field.id}-left-target`} className="table-row-handle" />
            <Handle type="source" position={Position.Left} id={`${field.id}-left-source`} className="table-row-handle" />
            <FieldBadge field={field} isForeignKey={refFieldIds.has(field.id)} />
            <span className="table-node-row-name" title={`${field.name} (${field.type})`}>
              {field.name}
            </span>

            <div className="table-node-row-badges">
              {field.pk && <span className="field-kw-badge field-kw-badge-pk" title="Primary Key">PK</span>}
              {field.unique && <span className="field-kw-badge field-kw-badge-unique" title="Unique">UQ</span>}
              {field.notNull && <span className="field-kw-badge field-kw-badge-notnull" title="Not Null">NN</span>}
              {field.increment && <span className="field-kw-badge field-kw-badge-increment" title="Auto Increment">AI</span>}
            </div>

            <div className="table-node-row-actions">
              <FieldEditorPopover
                field={field}
                onUpdateField={data.onUpdateField}
                onDeleteField={data.onDeleteField}
                triggerClassName="table-node-row-action-btn table-node-row-edit"
              />
              <CommentThread
                comments={fieldComments}
                currentUser={data.currentUser}
                onAdd={(text) => data.onAddComment(text, field.id)}
                onDelete={data.onDeleteComment}
                triggerClassName="table-node-row-action-btn table-node-row-comment"
                title={`Comments on ${field.name}`}
              />
            </div>

            <span className="table-node-row-type">{field.type}</span>

            <Handle type="target" position={Position.Right} id={`${field.id}-right-target`} className="table-row-handle" />
            <Handle type="source" position={Position.Right} id={`${field.id}-right-source`} className="table-row-handle" />
          </div>
        );
      })}
      {data.onAddField && table.detailLevel !== "compact" && (
        <div className="table-node-footer">
          <button
            type="button"
            className="table-node-add-btn nodrag"
            onClick={(e) => {
              e.stopPropagation();
              const count = table.fields.length + 1;
              data.onAddField?.({
                name: `field_${count}`,
                type: "varchar",
              });
            }}
            title="Add column to table"
          >
            <PlusIcon size={12} /> Add column
          </button>
        </div>
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);


