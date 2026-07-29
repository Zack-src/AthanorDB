import { memo } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import type { StickyNote } from "@athanordb/shared";
import { ColorSwatchPicker } from "./ColorSwatchPicker.js";

export interface StickyNoteNodeData {
  note: StickyNote;
  palette: string[];
  onPaletteChange: (palette: string[]) => void;
  onTextChange: (text: string) => void;
  onColorChange: (color: string) => void;
  onResize: (position: { x: number; y: number }, size: { width: number; height: number }) => void;
  [key: string]: unknown;
}

export type StickyNoteNodeType = Node<StickyNoteNodeData, "sticky">;

const DEFAULT_COLOR = "#fef08a";

function StickyNoteNodeImpl({ data, selected }: NodeProps<StickyNoteNodeType>) {
  const { note } = data;
  const color = note.style?.color ?? DEFAULT_COLOR;

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={80}
        isVisible={selected}
        onResizeEnd={(_, params) =>
          data.onResize({ x: params.x, y: params.y }, { width: params.width, height: params.height })
        }
      />
      <div
        className="sticky-node"
        style={{ background: color, border: `1px solid ${note.style?.borderColor ?? "#ca8a04"}` }}
      >
        <textarea
          className="nodrag sticky-node-textarea"
          value={note.text}
          onChange={(e) => data.onTextChange(e.target.value)}
          placeholder="Note…"
        />
        <div className="sticky-node-footer">
          <ColorSwatchPicker
            value={color}
            onChange={data.onColorChange}
            palette={data.palette}
            onPaletteChange={data.onPaletteChange}
            triggerClassName="sticky-node-swatch"
            title="Note color"
          />
        </div>
      </div>
    </>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeImpl);
