import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { RefCardinality } from "@athanordb/shared";

export interface RefEdgeData {
  cardinality: RefCardinality;
  [key: string]: unknown;
}

export type RefEdgeType = Edge<RefEdgeData, "ref">;

export const CARDINALITY_STYLE: Record<RefCardinality, { stroke: string; dash?: string; label: string }> = {
  "one-to-one": { stroke: "#818cf8", label: "1–1" },
  "one-to-many": { stroke: "#34d399", label: "1–n" },
  "many-to-many": { stroke: "#fbbf24", dash: "6 3", label: "n–n" },
};

export function RefEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  selected,
}: EdgeProps<RefEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const style = CARDINALITY_STYLE[data?.cardinality ?? "one-to-many"];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 2.25 : 1.5,
          strokeDasharray: style.dash,
          opacity: selected ? 1 : 0.85,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: "var(--color-surface-raised)",
            padding: "1px 6px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            color: style.stroke,
            border: `1px solid ${style.stroke}`,
            boxShadow: "var(--shadow-xs)",
            pointerEvents: "none",
          }}
        >
          {style.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
