import { memo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Field, Table } from "@athanordb/shared";
import { ColorSwatchPicker } from "./ColorSwatchPicker.js";
import { DiamondIcon, KeyIcon, LinkIcon } from "./Icons.js";

export interface TableNodeData {
  table: Table;
  /** Field ids that are either endpoint of some ref touching this table — always shown outside compact, even if not PK. */
  refFieldIds: Set<string>;
  onRename: (name: string) => void;
  onStyleChange: (color: string | undefined, borderColor: string | undefined) => void;
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
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        {renaming ? (
          <input
            autoFocus
            className="nodrag table-node-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
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
        <ColorSwatchPicker
          value={table.style?.color ?? DEFAULT_HEADER_COLOR}
          onChange={(color) => data.onStyleChange(color, table.style?.borderColor)}
          triggerClassName="table-node-swatch"
          title="Header color"
        />
      </div>
      {rows.map((field) => (
        <div key={field.id} className="table-node-row">
          <Handle type="target" position={Position.Left} id={field.id} style={{ background: "#9aa3b0" }} />
          <FieldBadge field={field} isForeignKey={refFieldIds.has(field.id)} />
          <span className="table-node-row-name">{field.name}</span>
          {table.detailLevel === "full" && <span className="table-node-row-type">{field.type}</span>}
          <Handle type="source" position={Position.Right} id={field.id} style={{ background: "#9aa3b0" }} />
        </div>
      ))}
    </div>
  );
}

export const TableNode = memo(TableNodeImpl);
