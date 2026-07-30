import { useCallback, useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, dropCursor } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { selectNextOccurrence } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Project } from "@athanordb/shared";
import { projectToDbml } from "@athanordb/dbml-engine";
import { ChevronLeftIcon, CodeIcon } from "./Icons.js";
import { dbmlLanguage, dbmlCompletion, athanorEditorTheme, customTabBinding } from "./codemirrorDbml.js";

type SyncStatus = "idle" | "typing" | "syncing" | "synced" | "error";

function SyncStatusPill({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const dotClass = status === "synced" ? "sync-dot-synced" : status === "error" ? "sync-dot-error" : "sync-dot-syncing";
  const label = { idle: "", typing: "Editing…", syncing: "Syncing…", synced: "Synced", error: "Sync error" }[status];
  return (
    <span className="sync-status">
      <span className={`sync-dot ${dotClass}`} />
      {label}
    </span>
  );
}

const DBML_SYNC_DEBOUNCE_MS = 600;

function CodeMirrorEditor(props: { value: string; onChange: (val: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: props.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        history(),
        bracketMatching(),
        closeBrackets(),
        EditorView.lineWrapping,
        oneDark,
        athanorEditorTheme,
        dbmlLanguage,
        autocompletion({ override: [dbmlCompletion], selectOnOpen: true }),
        keymap.of([
          customTabBinding,
          { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
          ...completionKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
        ]),
        // CodeMirror's own keymap dispatch calls preventDefault() for a
        // matched binding, but never stopPropagation() — the native keydown
        // still bubbles out of the editor afterward. The app's global
        // Ctrl+D/Ctrl+Z/Ctrl+Y canvas shortcuts (App.tsx) already try to
        // exclude `.cm-editor` via `e.target.closest(...)`, but that's a
        // second line of defense we shouldn't have to rely on being
        // perfectly in sync with every future shortcut added there. Stop it
        // at the source instead, for every ctrl/cmd-combo key this editor
        // itself binds (d/z/y), so it can never reach a window-level
        // listener regardless of how that guard is written.
        EditorView.domEventHandlers({
          keydown: (event) => {
            if ((event.ctrlKey || event.metaKey) && ["d", "z", "y"].includes(event.key.toLowerCase())) {
              event.stopPropagation();
            }
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (props.value !== currentDoc) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: props.value },
      });
    }
  }, [props.value]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", overflow: "hidden" }}
      onKeyDown={(e) => {
        // Stop canvas shortcuts from intercepting editor keys after CodeMirror processes them
        e.stopPropagation();
      }}
    />
  );
}

const DEFAULT_PANEL_WIDTH = 440;
const MIN_PANEL_WIDTH = 280;
const STORAGE_KEY_WIDTH = "athanordb_dbml_panel_width";

function DbmlPanel(props: { project: Project; projectId: string; onClose: () => void }) {
  const { project, projectId } = props;
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH) return parsed;
    }
    return DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(dirty);
  const lastAppliedTextRef = useRef<string | null>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const maxWidth = Math.min(1200, window.innerWidth - 100);
      const nextWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, startWidth + deltaX));
      setPanelWidth(nextWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);
      const deltaX = upEvent.clientX - startX;
      const maxWidth = Math.min(1200, window.innerWidth - 100);
      const finalWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, startWidth + deltaX));
      localStorage.setItem(STORAGE_KEY_WIDTH, String(finalWidth));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [panelWidth]);

  const handleDoubleClickResizer = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    localStorage.setItem(STORAGE_KEY_WIDTH, String(DEFAULT_PANEL_WIDTH));
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // Fetch initial DBML content
  useEffect(() => {
    fetch(`/api/projects/${projectId}/export/dbml`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
      .then((dbml) => {
        setText(dbml);
        lastAppliedTextRef.current = dbml;
        setStatus("synced");
      })
      .catch((err) => setError((err as Error).message));
  }, [projectId]);

  // Refetch only on remote changes when user is not dirty
  // Sync live project changes (e.g. node/ref deletions or modifications) into DBML text
  useEffect(() => {
    if (dirtyRef.current) return;
    try {
      const dbml = projectToDbml(project);
      if (text !== dbml && lastAppliedTextRef.current !== dbml) {
        setText(dbml);
        lastAppliedTextRef.current = dbml;
        setStatus("synced");
      }
    } catch {
      fetch(`/api/projects/${projectId}/export/dbml`)
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
        .then((dbml) => {
          if (dirtyRef.current) return;
          if (text === dbml || lastAppliedTextRef.current === dbml) return;
          setText(dbml);
          lastAppliedTextRef.current = dbml;
          setStatus("synced");
        })
        .catch((err) => setError((err as Error).message));
    }
  }, [project, projectId, text]);

  const applyNow = useCallback(
    (source: string) => {
      setStatus("syncing");
      lastAppliedTextRef.current = source;
      fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
        .then(async (res) => {
          if (res.ok) {
            setDirty(false);
            setError(null);
            setStatus("synced");
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? `Import failed (${res.status})`);
            setStatus("error");
          }
        })
        .catch((err) => {
          setError((err as Error).message);
          setStatus("error");
        });
    },
    [projectId],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setText(value);
    setDirty(true);
    setStatus("typing");
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyNow(value), DBML_SYNC_DEBOUNCE_MS);
  };

  return (
    <div className="side-panel nokey" style={{ width: panelWidth }}>
      <div
        className={`side-panel-resizer ${isResizing ? "is-resizing" : ""}`}
        onMouseDown={startResizing}
        onDoubleClick={handleDoubleClickResizer}
        title="Glisser pour redimensionner / Double-cliquer pour réinitialiser"
      />
      <div className="panel-header">
        <CodeIcon size={14} style={{ color: "var(--color-text-muted)" }} />
        <span className="panel-title">DBML</span>
        <SyncStatusPill status={status} />
        <span style={{ marginLeft: "auto" }} />
        <button className="btn btn-icon btn-ghost" onClick={props.onClose} title="Collapse editor">
          <ChevronLeftIcon size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CodeMirrorEditor value={text} onChange={handleChange} />
      </div>
      {error && (
        <div className="modal-error" style={{ margin: 8, borderRadius: "var(--radius-sm)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export { DbmlPanel };
export default DbmlPanel;
