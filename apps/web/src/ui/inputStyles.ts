/** Shared visual style for text inputs, selects and textareas — apply to the native element's className. */
export const INPUT_CLASS =
  "rounded-sm border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text " +
  "transition-colors duration-100 ease-out " +
  "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary-light " +
  "disabled:opacity-60";

/** Monospace code-editing textarea (DBML/SQL source panes) — same base as INPUT_CLASS, no resize handle. */
export const TEXTAREA_CODE_CLASS = `${INPUT_CLASS} resize-none font-mono text-[12.5px] leading-normal`;
