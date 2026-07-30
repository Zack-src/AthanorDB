export interface Point {
  x: number;
  y: number;
}

export function polylinePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export function orthogonalPolylinePath(points: Point[]): string {
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
export function closestSegmentIndex(points: Point[], p: Point): number {
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

export function getDefaultCornerPoints(pathString: string, startX: number, startY: number, endX: number, endY: number): Point[] {
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
