import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from "@xyflow/react";
import type { RefCardinality, RoutingPoint } from "@athanordb/shared";

export interface RefEdgeData {
  cardinality: RefCardinality;
  routingPoints?: RoutingPoint[];
  onRoutingPointsChange: (points: RoutingPoint[] | undefined) => void;
  [key: string]: unknown;
}

export type RefEdgeType = Edge<RefEdgeData, "ref">;

export const CARDINALITY_STYLE: Record<RefCardinality, { stroke: string; label: string }> = {
  "one-to-one": { stroke: "#818cf8", label: "1–1" },
  "one-to-many": { stroke: "#34d399", label: "1–n" },
  "many-to-many": { stroke: "#fbbf24", label: "n–n" },
};

interface Point {
  x: number;
  y: number;
}

function polylinePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Squared distance from `p` to its nearest point on segment `a`-`b`, plus the segment-relative position of that projection (0..1). */
function distToSegmentSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return (p.x - projX) ** 2 + (p.y - projY) ** 2;
}

/** Index of the segment (between `points[i]` and `points[i+1]`) closest to `p` — used to decide where a newly double-clicked waypoint gets inserted. */
function closestSegmentIndex(points: Point[], p: Point): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegmentSq(p, points[i], points[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

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
  const { screenToFlowPosition } = useReactFlow();
  const style = CARDINALITY_STYLE[data?.cardinality ?? "one-to-many"];
  const isManyToMany = data?.cardinality === "many-to-many";

  // Local drag state so a waypoint moves smoothly under the pointer without
  // writing to the shared doc on every mousemove — committed once on
  // pointerup, same pattern as node dragging elsewhere in this app.
  const [dragPoints, setDragPoints] = useState<RoutingPoint[] | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const points = dragPoints ?? data?.routingPoints ?? [];
  const allPoints: Point[] = useMemo(
    () => [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }],
    [sourceX, sourceY, points, targetX, targetY],
  );

  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const routed = points.length > 0;
  const fullPath = routed ? polylinePath(allPoints) : bezierPath;

  // Measured off the real rendered path rather than derived analytically —
  // works the same way whether `fullPath` is the bezier curve or a manual
  // polyline, and is what makes an accurate "converge on the middle" split
  // possible for many-to-many without hand-rolling bezier arc-length math.
  const measureRef = useRef<SVGPathElement>(null);
  const [split, setSplit] = useState<{ mid: Point; half1: string; half2: string } | null>(null);

  useEffect(() => {
    const path = measureRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    if (length === 0) {
      setSplit(null);
      return;
    }
    const SAMPLES = 16;
    const half1Points: Point[] = [];
    const half2Points: Point[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      half1Points.push(path.getPointAtLength((length / 2) * (i / SAMPLES)));
      half2Points.push(path.getPointAtLength(length - (length / 2) * (i / SAMPLES)));
    }
    setSplit({
      mid: path.getPointAtLength(length / 2),
      half1: polylinePath(half1Points),
      half2: polylinePath(half2Points),
    });
  }, [fullPath]);

  const labelX = routed ? (split?.mid.x ?? bezierLabelX) : bezierLabelX;
  const labelY = routed ? (split?.mid.y ?? bezierLabelY) : bezierLabelY;

  const commitPoints = (next: RoutingPoint[]) => {
    data?.onRoutingPointsChange(next.length > 0 ? next : undefined);
  };

  const handlePathDoubleClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const segIndex = closestSegmentIndex(allPoints, flowPos);
    const next = [...points.slice(0, segIndex), flowPos, ...points.slice(segIndex)];
    commitPoints(next);
  };

  const startDrag = (index: number, e: ReactMouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    draggingIndexRef.current = index;
    movedRef.current = false;
    setDragPoints(points);
    setSelectedPointIndex(index);

    const onMove = (ev: MouseEvent) => {
      movedRef.current = true;
      const flowPos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      setDragPoints((prev) => {
        if (!prev || draggingIndexRef.current === null) return prev;
        const next = [...prev];
        next[draggingIndexRef.current] = flowPos;
        return next;
      });
    };
    const onUp = () => {
      // A plain click-to-select is a mousedown immediately followed by
      // mouseup with no movement in between — committing then would write
      // an unchanged value to the shared doc, which still triggers a project
      // update and re-renders this edge, resetting `selectedPointIndex` back
      // to null before the user ever gets to press Delete.
      setDragPoints((prev) => {
        if (prev && movedRef.current) commitPoints(prev);
        return null;
      });
      draggingIndexRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (selectedPointIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      const next = (data?.routingPoints ?? []).filter((_, i) => i !== selectedPointIndex);
      commitPoints(next);
      setSelectedPointIndex(null);
    };
    // `e.stopPropagation()` in the waypoint's own React onClick handler only
    // stops other *React* handlers from seeing it — the native click still
    // bubbles to this plain `window` listener regardless, so selecting a
    // waypoint would otherwise immediately deselect it via this same click.
    const onClickOutside = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".ref-edge-waypoint")) return;
      setSelectedPointIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClickOutside);
    };
    // Only re-attach when the selection itself changes — `data.routingPoints`
    // is read fresh inside the handler on each keypress rather than added as
    // a dependency, so typing/moving other waypoints doesn't churn these
    // window listeners on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPointIndex]);

  const strokeWidth = selected ? 3 : 2.25;
  const dotAnimation = `ref-edge-flow ${selected ? 0.5 : 0.8}s linear infinite`;

  return (
    <>
      <path ref={measureRef} d={fullPath} fill="none" stroke="none" style={{ pointerEvents: "none" }} />
      {isManyToMany && split ? (
        <>
          <path
            d={split.half1}
            fill="none"
            className="ref-edge-flow-path"
            style={{ stroke: style.stroke, strokeWidth, opacity: selected ? 1 : 0.85, animation: dotAnimation }}
          />
          <path
            d={split.half2}
            fill="none"
            markerEnd={markerEnd}
            className="ref-edge-flow-path"
            style={{ stroke: style.stroke, strokeWidth, opacity: selected ? 1 : 0.85, animation: dotAnimation }}
          />
        </>
      ) : (
        <path
          d={fullPath}
          fill="none"
          markerEnd={markerEnd}
          className="ref-edge-flow-path"
          style={{ stroke: style.stroke, strokeWidth, opacity: selected ? 1 : 0.85, animation: dotAnimation }}
        />
      )}
      {/* Wide, fully transparent path so double-click-to-add-waypoint is easy to hit without needing pixel precision on the thin visible line. */}
      <path
        d={fullPath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: "copy" }}
        onDoubleClick={handlePathDoubleClick}
      />
      <EdgeLabelRenderer>
        {points.map((p, i) => (
          <div
            key={i}
            className={`ref-edge-waypoint nodrag nopan${i === selectedPointIndex ? " ref-edge-waypoint-selected" : ""}`}
            style={{ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`, borderColor: style.stroke }}
            onMouseDown={(e) => startDrag(i, e)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPointIndex(i);
            }}
            title="Drag to move, select and press Delete to remove"
          />
        ))}
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
