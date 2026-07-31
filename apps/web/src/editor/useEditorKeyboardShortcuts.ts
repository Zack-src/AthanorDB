import { useEffect } from "react";
import type * as Y from "yjs";

/** Ctrl/Cmd+Z (undo), +Shift+Z or +Y (redo), +D (duplicate selection) — ignored while typing in an input/editor. */
export function useEditorKeyboardShortcuts(undoManager: Y.UndoManager | null, duplicateSelected: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        Boolean(target.closest(".cm-editor, .nokey, [contenteditable='true']"))
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) undoManager?.redo();
        else undoManager?.undo();
      } else if (key === "y") {
        e.preventDefault();
        undoManager?.redo();
      } else if (key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoManager, duplicateSelected]);
}
