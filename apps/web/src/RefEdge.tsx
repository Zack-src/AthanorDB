import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps } from "@xyflow/react";
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

function orthogonalPolylinePath(points: Point[]): string {
  if (points.length < 2) return "";
  const result: Point[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    if (curr.x !== next.x && curr.y !== next.y) {
      const midX = (curr.x + next.x) / 2;
      result.push({ x: midX, y: curr.y });
      result.push({ x: midX, y: next.y });
    }
    result.push(next);
  }
  return polylinePath(result);
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

function getDefaultCornerPoints(pathString: string, startX: number, startY: number, endX: number, endY: number): Point[] {
  const points: Point[] = [];
  const regex = /[L]\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(pathString)) !== null) {
    const x = Math.round(parseFloat(match[1]));
    const y = Math.round(parseFloat(match[2]));
    const isStart = Math.abs(x - Math.round(startX)) < 4 && Math.abs(y - Math.round(startY)) < 4;
    const isEnd = Math.abs(x - Math.round(endX)) < 4 && Math.abs(y - Math.round(endY)) < 4;
    if (!isStart && !isEnd) {
      points.push({ x, y });
    }
  }
  return points;
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

  const [dragPoints, setDragPoints] = useState<RoutingPoint[] | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pointIndex?: number } | null>(null);

  const [stepPath, stepLabelX, stepLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  const defaultCorners = useMemo(() => {
    return getDefaultCornerPoints(stepPath, sourceX, sourceY, targetX, targetY);
  }, [stepPath, sourceX, sourceY, targetX, targetY]);

  const hasCustomRouting = Boolean(data?.routingPoints && data.routingPoints.length > 0);
  const points = dragPoints ?? data?.routingPoints ?? defaultCorners;

  const allPoints: Point[] = useMemo(
    () => [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }],
    [sourceX, sourceY, points, targetX, targetY],
  );

  const fullPath = orthogonalPolylinePath(allPoints);

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

  const labelX = split?.mid.x ?? stepLabelX;
  const labelY = split?.mid.y ?? stepLabelY;

  const commitPoints = (next: RoutingPoint[]) => {
    data?.onRoutingPointsChange(next.length > 0 ? next : undefined);
  };

  const resetRouting = () => {
    data?.onRoutingPointsChange(undefined);
    setDragPoints(null);
    setSelectedPointIndex(null);
    setContextMenu(null);
  };

  const deletePointAt = (index: number) => {
    const next = points.filter((_, i) => i !== index);
    commitPoints(next);
    setSelectedPointIndex(null);
    setContextMenu(null);
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

  const handleContextMenu = (e: ReactMouseEvent, pointIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, pointIndex });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("wheel", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("wheel", close);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (selectedPointIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        Boolean(target.closest(".monaco-editor, .cm-editor, .nokey, [contenteditable='true']"))
      ) {
        return;
      }
      e.preventDefault();
      deletePointAt(selectedPointIndex);
    };
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
  }, [selectedPointIndex, points]);

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
      <path
        d={fullPath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: "copy" }}
        onDoubleClick={handlePathDoubleClick}
        onContextMenu={(e) => handleContextMenu(e)}
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
            onContextMenu={(e) => handleContextMenu(e, i)}
            title="Glisser pour déplacer, Suppr pour supprimer, Clic droit pour options"
          />
        ))}
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: "var(--color-surface-raised)",
            padding: "2px 6px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            color: style.stroke,
            border: `1px solid ${style.stroke}`,
            boxShadow: "var(--shadow-xs)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "auto",
          }}
          onContextMenu={(e) => handleContextMenu(e)}
        >
          <span>{style.label}</span>
          {(hasCustomRouting || points.length !== defaultCorners.length) && (
            <button
              onClick={resetRouting}
              style={{
                background: "transparent",
                border: "none",
                color: style.stroke,
                cursor: "pointer",
                padding: "0 2px",
                fontSize: 11,
                lineHeight: 1,
              }}
              title="Réinitialiser le tracé (points automatiques)"
            >
              ↻
            </button>
          )}
        </div>
        {contextMenu && (
          <div
            className="context-menu nodrag nopan"
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.pointIndex !== undefined && (
              <button className="context-menu-item" onClick={() => deletePointAt(contextMenu.pointIndex!)}>
                Supprimer ce point
              </button>
            )}
            <button className="context-menu-item" onClick={resetRouting}>
              Réinitialiser le tracé
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
