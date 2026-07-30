import type { MouseEvent as ReactMouseEvent } from "react";
import type { Point } from "./pathMath.js";

/** Draggable dots on each of a ref's custom/default corner points. */
export function EdgeWaypoints(props: {
  points: Point[];
  selectedIndex: number | null;
  strokeColor: string;
  onStartDrag: (index: number, e: ReactMouseEvent) => void;
  onSelect: (index: number) => void;
  onContextMenu: (e: ReactMouseEvent, index: number) => void;
}) {
  return (
    <>
      {props.points.map((p, i) => (
        <div
          key={i}
          // z-10: React Flow always paints nodes over the edge-label-renderer layer (fixed DOM
          // order, not z-index-driven), so a waypoint landing near/under a table would otherwise
          // be un-clickable — exactly where routing a waypoint to steer *around* that table is
          // most needed.
          className={`pointer-events-auto absolute z-10 h-2.5 w-2.5 cursor-grab rounded-full border-2 bg-surface shadow-xs active:cursor-grabbing nodrag nopan${i === props.selectedIndex ? " shadow-[0_0_0_2px_var(--color-primary)]" : ""}`}
          style={{ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`, borderColor: props.strokeColor }}
          onMouseDown={(e) => props.onStartDrag(i, e)}
          onClick={(e) => {
            e.stopPropagation();
            props.onSelect(i);
          }}
          onContextMenu={(e) => props.onContextMenu(e, i)}
          data-tooltip="Glisser pour déplacer, Suppr pour supprimer, Clic droit pour options"
        />
      ))}
    </>
  );
}
