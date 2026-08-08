/**
 * Figma-style floating canvas toolbar: one rounded pill, centred at the bottom
 * of the canvas, with controls grouped by purpose (insert · view · display ·
 * zoom · plugins) and separated by thin dividers.
 */

export const CANVAS_TOOLBAR_CLASS =
  "pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-surface-raised/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md";

export const CANVAS_TOOLBAR_DIVIDER_CLASS = "mx-1 h-5 w-px shrink-0 bg-border";

/** Square icon button — the toolbar's default control. */
export const CANVAS_TOOLBAR_ICON_BTN_CLASS =
  "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-text-secondary transition-colors duration-100 hover:bg-white/10 hover:text-text disabled:pointer-events-none disabled:opacity-40";

/** Text/label control — detail level, zoom percentage, font size steppers. */
export const CANVAS_TOOLBAR_SEGMENT_CLASS =
  "flex h-7 cursor-pointer items-center rounded-lg border-0 bg-transparent px-2 text-[11.5px] font-medium text-text-secondary transition-colors duration-100 hover:bg-white/10 hover:text-text disabled:pointer-events-none disabled:opacity-40";

export const CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS = "bg-primary-light text-primary-hover hover:bg-primary-light hover:text-primary-hover";

/** Toggle in its "on" state (link highlight, minimap). */
export const CANVAS_TOOLBAR_TOGGLE_ACTIVE_CLASS = "bg-primary-light text-primary-hover hover:bg-primary-light hover:text-primary-hover";
