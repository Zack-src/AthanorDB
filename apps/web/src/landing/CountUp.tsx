import { useEffect, useRef, useState } from "react";
import { useReveal } from "./useReveal.js";

export interface CountUpProps {
  to: number;
  suffix?: string;
  prefix?: string;
  durationMs?: number;
  decimals?: number;
}

/** Counts up from 0 to `to` once the element scrolls into view. Pure rAF, no dependency. */
export function CountUp({ to, suffix = "", prefix = "", durationMs = 1400, decimals = 0 }: CountUpProps) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const [value, setValue] = useState(0);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!visible || playedRef.current) return;
    playedRef.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(to * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, to, durationMs]);

  return (
    <span ref={ref} className="landing-stat-num">
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
