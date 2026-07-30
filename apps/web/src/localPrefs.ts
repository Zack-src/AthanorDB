import type { Viewport } from "@xyflow/react";

// Canvas text size (accessibility) — a personal display preference, not
// project data, so it lives in localStorage rather than the shared doc.
export const FONT_SCALE_KEY = "athanordb.canvasFontScale";
export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.15;

export function loadFontScale(): number {
  const saved = Number(localStorage.getItem(FONT_SCALE_KEY));
  return saved >= FONT_SCALE_MIN && saved <= FONT_SCALE_MAX ? saved : 1;
}

// Canvas pan/zoom — also personal, and specific to a (project, user) pair
// rather than the project itself, so it's keyed localStorage rather than
// shared-doc state: two people on the same project shouldn't yank each
// other's viewport around, and the same person's saved position shouldn't
// follow them into a different project. Keyed by the session's stable user
// id (not the editable display name) so renaming yourself doesn't lose it.
export function viewportKey(projectId: string, userId: string): string {
  return `athanordb.viewport.${projectId}.${userId}`;
}

export function loadViewport(projectId: string, userId: string): Viewport | null {
  try {
    const raw = localStorage.getItem(viewportKey(projectId, userId));
    return raw ? (JSON.parse(raw) as Viewport) : null;
  } catch {
    return null;
  }
}

export const HIGHLIGHT_LINKS_KEY = "athanordb.highlightLinks";

export function loadHighlightLinks(): boolean {
  const saved = localStorage.getItem(HIGHLIGHT_LINKS_KEY);
  return saved !== null ? saved === "true" : false;
}

export function saveHighlightLinks(val: boolean): void {
  localStorage.setItem(HIGHLIGHT_LINKS_KEY, String(val));
}

export const SHOW_MINIMAP_KEY = "athanordb.showMinimap";

export function loadShowMinimap(): boolean {
  const saved = localStorage.getItem(SHOW_MINIMAP_KEY);
  return saved !== null ? saved === "true" : true;
}

export function saveShowMinimap(val: boolean): void {
  localStorage.setItem(SHOW_MINIMAP_KEY, String(val));
}
