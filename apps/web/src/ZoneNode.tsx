import { memo, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { Zone } from "@athanordb/shared";
import { ColorSwatchPicker } from "./ColorSwatchPicker.js";

export interface ZoneNodeData {
  zone: Zone;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onResize: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  [key: string]: unknown;
}

export type ZoneNodeType = Node<ZoneNodeData, "zone">;

const DEFAULT_COLOR = "#f59e0b";

function ZoneNodeImpl({ data, selected }: NodeProps<ZoneNodeType>) {
  const { zone } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(zone.label);
  const color = zone.style?.color ?? DEFAULT_COLOR;

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== zone.label) data.onLabelChange(trimmed);
    else setDraft(zone.label);
  };

  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={80}
        isVisible={selected}
        onResizeEnd={(_, params) =>
          data.onResize({ x: params.x, y: params.y }, { width: params.width, height: params.height })
        }
      />
      <div
        className="zone-node"
        style={{
          background: `${color}1f`,
          border: `1.5px dashed ${zone.style?.borderColor ?? color}`,
        }}
        onDoubleClick={() => setEditing(true)}
      >
        <div className="zone-node-label-row">
          {editing ? (
            <input
              autoFocus
              className="nodrag zone-node-label-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(zone.label);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span className="zone-node-label" style={{ color }} title="Double-click to rename">
              {zone.label}
            </span>
          )}
          <ColorSwatchPicker value={color} onChange={data.onColorChange} triggerClassName="zone-node-swatch" title="Zone color" />
        </div>
      </div>
    </>
  );
}

export const ZoneNode = memo(ZoneNodeImpl);
