import type { ReactNode } from "react";

type Tone = "admin" | "muted" | "warning" | "success" | "danger";

const TONE: Record<Tone, string> = {
  admin: "bg-primary-light text-primary",
  muted: "bg-surface-hover text-text-muted",
  warning: "bg-warning-light text-warning",
  success: "bg-success-light text-success",
  danger: "bg-danger-light text-danger",
};

/** Small uppercase pill — admin/view-only/invitation-status labels. */
export function Badge(props: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`rounded-full px-1.5 py-px text-[10px] font-bold uppercase ${TONE[props.tone]} ${props.className ?? ""}`.trim()}>
      {props.children}
    </span>
  );
}

/** Numeric count pill (e.g. validation issue count on the toolbar). */
export function CountBadge(props: { count: number; danger?: boolean }) {
  return (
    <span
      className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${props.danger ? "bg-danger" : "bg-text-muted"}`}
    >
      {props.count}
    </span>
  );
}
