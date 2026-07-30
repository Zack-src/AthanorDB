import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type TooltipPos = "top" | "bottom" | "left";

interface TooltipState {
  text: string;
  rect: DOMRect;
  pos: TooltipPos;
}

const SHOW_DELAY = 400;

/**
 * Single delegated tooltip for every `data-tooltip` element in the app.
 * Portaled to `document.body` and positioned with `position: fixed` from the
 * hovered element's own rect, so it never gets clipped by an ancestor's
 * `overflow: hidden`/`auto` (the header's horizontal scroll area, React
 * Flow's Controls panel, etc.) the way a CSS `::after` on the element itself
 * would be. Mount once near the app root.
 */
export function GlobalTooltip() {
  const [state, setState] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const hide = () => {
      clearTimer();
      targetRef.current = null;
      setState(null);
    };

    const show = (el: Element) => {
      const text = el.getAttribute("data-tooltip");
      if (!text) return;
      const pos = (el.getAttribute("data-tooltip-pos") as TooltipPos | null) ?? "top";
      setState({ text, rect: el.getBoundingClientRect(), pos });
    };

    const onOver = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[data-tooltip]");
      if (!el || el === targetRef.current) return;
      clearTimer();
      targetRef.current = el;
      timerRef.current = window.setTimeout(() => show(el), SHOW_DELAY);
    };

    const onOut = (e: Event) => {
      if (!targetRef.current) return;
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related && targetRef.current.contains(related)) return;
      hide();
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("focusin", onOver, true);
    document.addEventListener("focusout", onOut, true);
    document.addEventListener("mousedown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      clearTimer();
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("focusin", onOver, true);
      document.removeEventListener("focusout", onOut, true);
      document.removeEventListener("mousedown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!state) return null;

  const { text, rect, pos } = state;
  const style: CSSProperties = { position: "fixed" };
  if (pos === "bottom") {
    style.top = rect.bottom + 8;
    style.left = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
    style.transform = "translateX(-50%)";
  } else if (pos === "left") {
    style.top = rect.top + rect.height / 2;
    style.left = rect.left - 8;
    style.transform = "translate(-100%, -50%)";
  } else {
    style.top = Math.max(rect.top - 8, 34);
    style.left = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
    style.transform = "translate(-50%, -100%)";
  }

  return createPortal(
    <div className={`gtooltip gtooltip-${pos}`} style={style}>
      {text}
    </div>,
    document.body,
  );
}
