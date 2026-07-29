import { useCallback, useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, dropCursor } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Project } from "@athanordb/shared";
import { ChevronLeftIcon, CodeIcon } from "./Icons.js";
import { dbmlLanguage, dbmlCompletion, athanorEditorTheme } from "./codemirrorDbml.js";

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
        autocompletion({ override: [dbmlCompletion] }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
        ]),
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
      onKeyDownCapture={(e) => {
        // Stop canvas shortcuts from intercepting arrow keys or editing keys
        e.stopPropagation();
      }}
    />
  );
}

function DbmlPanel(props: { project: Project; projectId: string; onClose: () => void }) {
  const { project, projectId } = props;
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(dirty);
  const lastAppliedTextRef = useRef<string | null>(null);

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
  useEffect(() => {
    if (dirtyRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projectId]);

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
    <div className="side-panel nokey" style={{ width: 440 }}>
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
