type ServerStatus = "checking" | "ok" | "down";

const DOT_TONE: Record<ServerStatus, string> = {
  ok: "bg-success shadow-[0_0_0_3px_var(--color-success-light)]",
  down: "bg-danger shadow-[0_0_0_3px_var(--color-danger-light)]",
  checking: "bg-text-muted",
};

const LABEL: Record<ServerStatus, string> = {
  ok: "connected",
  down: "server unreachable",
  checking: "connecting…",
};

/** Server-connection indicator shown in the header — a colored dot plus a short label. */
export function StatusPill(props: { status: ServerStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_TONE[props.status]}`} />
      {LABEL[props.status]}
    </span>
  );
}
