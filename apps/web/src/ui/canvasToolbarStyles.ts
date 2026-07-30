/** Figma-style floating canvas toolbar — one horizontal pill, grouped controls separated by thin dividers. */

export const CANVAS_TOOLBAR_CLASS =
  "flex items-center gap-0.5 rounded-full border border-border bg-surface-raised/95 p-1 shadow-lg backdrop-blur-sm";

export const CANVAS_TOOLBAR_DIVIDER_CLASS = "mx-0.5 h-5 w-px shrink-0 bg-border";

export const CANVAS_TOOLBAR_ICON_BTN_CLASS =
  "!h-7 !w-7 !rounded-full !border-0 !bg-transparent !text-text-secondary !shadow-none hover:!bg-white/10 hover:!text-text [&_svg]:!max-h-none [&_svg]:!max-w-none";

export const CANVAS_TOOLBAR_SEGMENT_CLASS =
  "rounded-full px-2.5 py-1 text-[11.5px] font-medium text-text-secondary transition-colors duration-100 hover:bg-white/10 hover:text-text";
export const CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS = "bg-primary-light text-primary-hover hover:bg-primary-light hover:text-primary-hover";
