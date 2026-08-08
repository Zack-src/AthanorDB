import type { CSSProperties, ReactNode } from "react";
import { useReveal } from "./useReveal.js";

export interface RevealProps {
  children: ReactNode;
  /** Stagger delay in ms — pass `index * 70` in a `.map()` for a cascade. */
  delay?: number;
  className?: string;
  /** Entrance direction; `up` (default) is the safe choice for text blocks. */
  from?: "up" | "left" | "right" | "scale";
  as?: "div" | "span" | "li";
}

const OFFSET: Record<NonNullable<RevealProps["from"]>, string> = {
  up: "translateY(28px)",
  left: "translateX(-28px)",
  right: "translateX(28px)",
  scale: "scale(0.94)",
};

/** Fades + slides a block in the first time it scrolls into view. One-shot, CSS-driven, no layout thrash. */
export function Reveal({ children, delay = 0, className = "", from = "up", as = "div" }: RevealProps) {
  const { ref, visible } = useReveal<HTMLElement>();
  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : OFFSET[from],
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    willChange: "opacity, transform",
  };
  const Tag = as;
  return (
    // @ts-expect-error -- ref type is narrowed to HTMLElement for reuse across tag variants
    <Tag ref={ref} style={style} className={className}>
      {children}
    </Tag>
  );
}
