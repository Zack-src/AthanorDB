import { useEffect, useRef, useState } from "react";

/** True once, on first render, for anyone who has asked the OS for less motion. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll-triggered reveal: `visible` flips to `true` the first time the
 * element crosses `rootMargin` into the viewport, then the observer
 * disconnects — a one-shot "play this entrance once" primitive, not a
 * continuous visibility tracker. Respects `prefers-reduced-motion` by
 * starting (and staying) visible, so nothing depends on JS running an
 * animation for the content to actually appear.
 */
export function useReveal<T extends HTMLElement>(options?: { rootMargin?: string; threshold?: number }) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: options?.rootMargin ?? "0px 0px -10% 0px", threshold: options?.threshold ?? 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options object is not stable across renders; read once at mount
  }, [visible]);

  return { ref, visible };
}

/**
 * Which step (by index) is currently "active" in a scroll-pinned sequence —
 * the entry whose intersection ratio with the viewport center is highest.
 * Used to drive a sticky visual that reacts to which text block the reader
 * is next to, instead of a fixed scroll-linked timeline.
 */
export function useActiveStep(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.stepIndex);
          ratios.set(idx, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestIdx = 0;
        let bestRatio = -1;
        for (const [idx, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIdx = idx;
          }
        }
        if (bestRatio > 0) setActive(bestIdx);
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const node of refs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  const setStepRef = (index: number) => (node: HTMLElement | null) => {
    refs.current[index] = node;
    if (node) node.dataset.stepIndex = String(index);
  };

  return { active, setStepRef };
}

/**
 * Pointer position as CSS custom properties (`--mx`/`--my`, element-relative
 * percentages) on the given ref, updated via `requestAnimationFrame` so the
 * listener never fires the actual style write more than once per frame.
 * Powers the cursor-glow and magnetic-button effects without touching React
 * state (a state write per mousemove would repaint the whole subtree).
 */
export function usePointerGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending || !node) return;
      const rect = node.getBoundingClientRect();
      const mx = ((pending.x - rect.left) / rect.width) * 100;
      const my = ((pending.y - rect.top) / rect.height) * 100;
      node.style.setProperty("--mx", `${mx}%`);
      node.style.setProperty("--my", `${my}%`);
    };

    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };

    node.addEventListener("pointermove", onMove);
    return () => {
      node.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
