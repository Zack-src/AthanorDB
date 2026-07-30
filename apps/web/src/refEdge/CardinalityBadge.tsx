import type { MouseEvent as ReactMouseEvent } from "react";

/** The floating "1–n"/etc. pill at an edge's midpoint; shows a reset-routing button once the path has been customized. */
export function CardinalityBadge(props: {
  x: number;
  y: number;
  label: string;
  color: string;
  showReset: boolean;
  onReset: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}) {
  return (
    <div
      className="nodrag nopan"
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${props.x}px, ${props.y}px)`,
        background: "var(--color-surface-raised)",
        padding: "2px 6px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        color: props.color,
        border: `1px solid ${props.color}`,
        boxShadow: "var(--shadow-xs)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        pointerEvents: "auto",
      }}
      onContextMenu={props.onContextMenu}
    >
      <span>{props.label}</span>
      {props.showReset && (
        <button
          onClick={props.onReset}
          style={{
            background: "transparent",
            border: "none",
            color: props.color,
            cursor: "pointer",
            padding: "0 2px",
            fontSize: 11,
            lineHeight: 1,
          }}
          data-tooltip="Réinitialiser le tracé (points automatiques)"
        >
          ↻
        </button>
      )}
    </div>
  );
}
