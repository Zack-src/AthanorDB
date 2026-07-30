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
          className={`ref-edge-waypoint nodrag nopan${i === props.selectedIndex ? " ref-edge-waypoint-selected" : ""}`}
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
