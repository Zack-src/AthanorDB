import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { Project } from "@athanordb/shared";
import { ChevronLeftIcon, CodeIcon } from "./Icons.js";
// Monaco setup (self-hosted worker + dbml language registration) is a
// module-scope side effect — importing it here (rather than eagerly at
// app start, in main.tsx) means it only loads once this panel is actually
// lazy-loaded, i.e. once a project is opened, not on the project list page.
import "./monacoSetup.js";

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

/**
 * Live DBML view of the project — edits sync to the canvas automatically as
 * you type, debounced, rather than requiring an explicit "Apply". Text comes
 * from the server's `/export/dbml` (same route `ExportDialog` uses) rather
 * than generating it client-side — `dbml-engine` wraps `@dbml/core`, which
 * instantiates a parser at module scope, so importing even the pure-string
 * `projectToDbml` from it would drag that whole (multi-MB) parser library
 * into the browser bundle. Re-fetches on every remote doc change *unless*
 * the user has unconfirmed local edits ("dirty") — otherwise a peer's edit
 * would silently overwrite what they're typing. Auto-sync POSTs to the same
 * `/import` route `ImportDialog` uses, which merges by name server-side so
 * tables/fields untouched by the edit keep their id, position, and detail
 * level rather than resetting.
 *
 * Known limitation: because this round-trips through the server (parsing has
 * to stay server-side — see above), edits made here arrive back over the
 * WebSocket like any remote change and so fall outside the local
 * `Y.UndoManager`'s tracked origins. Ctrl+Z undoes canvas edits but not DBML
 * panel edits; only the "Restore this revision" history flow can revert them.
 */
function DbmlPanel(props: { project: Project; projectId: string; user: string; onClose: () => void }) {
  const { project, projectId, user } = props;
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  // executeEdits() below fires Monaco's onDidChangeModelContent same as a
  // real keystroke would — @monaco-editor/react only suppresses that for
  // edits *it* drives via the controlled `value` prop, not edits made
  // directly through the editor API. Without this flag, our own remote-sync
  // replace loops back through `handleChange` as if the user had just typed
  // the (already-applied) server text, marking the doc dirty and
  // re-POSTing it to /import — a redundant round-trip at best, and a race
  // that can transiently wipe content at worst when it overlaps a real edit.
  const suppressNextChangeRef = useRef(false);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Server-reformatted DBML replaces the editor's content on every sync (own
  // edits included, once the debounce round-trips). A plain `setText` would
  // hand that new value to Monaco as a full-document replace with no
  // explicit cursor target, which snaps the caret to wherever Monaco's
  // default post-edit position lands — reported as the view "jumping"
  // mid-type. Driving the replace through the editor API directly lets us
  // snapshot/restore cursor, selection and scroll position around it.
  //
  // The server always emits LF, but Monaco's default model EOL is CRLF on
  // Windows — left unnormalized, that alone makes every single refetch look
  // "changed" and forces a full-buffer replace even when nothing meaningful
  // did. Normalizing to the model's own EOL first means a same-content sync
  // is a true no-op (no replace, no jump), and keeps `text` state in the
  // model's EOL convention so the Editor's own controlled-value diff doesn't
  // independently detect a (spurious) mismatch and redo the replace itself.
  const setTextPreservingView = (next: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      setText(next);
      return;
    }
    const normalized = next.replace(/\r\n|\n/g, model.getEOL());
    if (model.getValue() !== normalized) {
      suppressNextChangeRef.current = true;
      const viewState = editor.saveViewState();
      editor.executeEdits("remote-sync", [{ range: model.getFullModelRange(), text: normalized }]);
      if (viewState) editor.restoreViewState(viewState);
    }
    setText(normalized);
  };

  const refetch = () => {
    fetch(`/api/projects/${projectId}/export/dbml`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
      .then((dbml) => {
        setTextPreservingView(dbml);
        setStatus("synced");
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    if (!dirty) refetch();
    // project is a new object on every doc change (see useProjectDoc), so it's
    // exactly the "something changed remotely" signal this should refetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dirty]);

  const applyNow = useCallback(
    (source: string) => {
      setStatus("syncing");
      fetch(`/api/projects/${projectId}/import?user=${encodeURIComponent(user)}`, {
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
    [projectId, user],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (value: string | undefined) => {
    if (suppressNextChangeRef.current) {
      suppressNextChangeRef.current = false;
      return;
    }
    const next = value ?? "";
    setText(next);
    setDirty(true);
    setStatus("typing");
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyNow(next), DBML_SYNC_DEBOUNCE_MS);
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
        <Editor
          language="dbml"
          theme="vs-dark"
          value={text}
          onChange={handleChange}
          onMount={handleMount}
          options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, padding: { top: 10 } }}
        />
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
