import { memo, useMemo, useState } from "react";
import { Handle, Position, useEdges, type Node, type NodeProps } from "@xyflow/react";
import type { Field, Table } from "@athanordb/shared";
import { ColorSwatchPicker } from "./ColorSwatchPicker.js";
import { CommentThread } from "./CommentThread.js";
import { DiamondIcon, KeyIcon, LinkIcon } from "./Icons.js";

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
  [key: string]: unknown;
}

export type TableNodeType = Node<TableNodeData, "table">;

const DEFAULT_HEADER_COLOR = "#334155";

function FieldBadge({ field, isForeignKey }: { field: Field; isForeignKey: boolean }) {
  if (field.pk) return <KeyIcon className="table-node-row-icon table-node-row-icon-pk" />;
  if (field.unique) return <DiamondIcon className="table-node-row-icon table-node-row-icon-unique" />;
  if (isForeignKey) return <LinkIcon className="table-node-row-icon" />;
  return <span className="table-node-row-icon" />;
}

function TableNodeImpl({ data, selected }: NodeProps<TableNodeType>) {
  const { table, refFieldIds } = data;
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(table.name);
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
        <CommentThread
          comments={tableComments}
          currentUser={data.currentUser}
          onAdd={(text) => data.onAddComment(text)}
          onDelete={data.onDeleteComment}
          triggerClassName="table-node-comment"
          title="Table comments"
        />
        <ColorSwatchPicker
          value={table.style?.color ?? DEFAULT_HEADER_COLOR}
          onChange={(color) => data.onStyleChange(color, table.style?.borderColor)}
          palette={data.palette}
          onPaletteChange={data.onPaletteChange}
          triggerClassName="table-node-swatch"
          title="Header color"
        />
      </div>
      {rows.map((field) => {
        const fieldComments = table.comments?.filter((c) => c.fieldId === field.id) ?? [];
        const isLinked = Boolean(
          (data.highlightLinks && refFieldIds.has(field.id)) ||
          selectedEdgeFieldIds.has(field.id)
        );
        return (
          <div key={field.id} className={`table-node-row${isLinked ? " table-node-row-linked" : ""}`}>
            <Handle type="target" position={Position.Left} id={`${field.id}-left-target`} className="table-row-handle" />
            <Handle type="source" position={Position.Left} id={`${field.id}-left-source`} className="table-row-handle" />
            <FieldBadge field={field} isForeignKey={refFieldIds.has(field.id)} />
            <span className="table-node-row-name">{field.name}</span>
            {table.detailLevel === "full" && <span className="table-node-row-type">{field.type}</span>}
            <CommentThread
              comments={fieldComments}
              currentUser={data.currentUser}
              onAdd={(text) => data.onAddComment(text, field.id)}
              onDelete={data.onDeleteComment}
              triggerClassName={`table-node-row-comment${table.detailLevel !== "full" ? " table-node-row-comment-auto" : ""}`}
              title={`Comments on ${field.name}`}
            />
            <Handle type="target" position={Position.Right} id={`${field.id}-right-target`} className="table-row-handle" />
            <Handle type="source" position={Position.Right} id={`${field.id}-right-source`} className="table-row-handle" />
          </div>
        );
      })}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
