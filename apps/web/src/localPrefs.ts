import type { Viewport } from "@xyflow/react";

const USER_KEY = "athanordb.user";

export function loadUser(): string {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) return saved;
  const generated = `user-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(USER_KEY, generated);
  return generated;
}

export function saveUser(user: string): void {
  localStorage.setItem(USER_KEY, user);
}

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
// follow them into a different project.
export function viewportKey(projectId: string, user: string): string {
  return `athanordb.viewport.${projectId}.${user}`;
}

export function loadViewport(projectId: string, user: string): Viewport | null {
  try {
    const raw = localStorage.getItem(viewportKey(projectId, user));
    return raw ? (JSON.parse(raw) as Viewport) : null;
  } catch {
    return null;
  }
}
