import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { Project } from "@athanordb/shared";
import { ChevronLeftIcon, CodeIcon } from "./Icons.js";
// Monaco setup (self-hosted worker + dbml language registration) is a
// module-scope side effect — importing it here (rather than eagerly at
// app start, in main.tsx) means it only loads once this panel is actually
// lazy-loaded, i.e. once a project is opened, not on the project list page.
// The named `monaco` export is the same singleton; importing it too (instead
// of a bare side-effect import) lets us build a `Range` below without a
// second, separately-bundled copy of monaco-editor.
import { monaco } from "./monacoSetup.js";

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

// Smallest [start, end) region of `oldText` that differs from `newText`,
// found by trimming a common prefix and common suffix. Not a general diff
// (a reorder can produce a needlessly large middle region) but for
// server-reformatted DBML — whitespace/quote/ordering tweaks around the
// change the user actually made — the differing region is almost always
// small and localized, which is what lets Monaco leave the cursor alone.
function minimalDiffRange(oldText: string, newText: string): { start: number; end: number; text: string } | null {
  if (oldText === newText) return null;
  const maxStart = Math.min(oldText.length, newText.length);
  let start = 0;
  while (start < maxStart && oldText.charCodeAt(start) === newText.charCodeAt(start)) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText.charCodeAt(oldEnd - 1) === newText.charCodeAt(newEnd - 1)) {
    oldEnd--;
    newEnd--;
  }
  return { start, end: oldEnd, text: newText.slice(start, newEnd) };
}

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
function DbmlPanel(props: { project: Project; projectId: string; onClose: () => void }) {
  const { project, projectId } = props;
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
  // `refetch` below is async and un-abortable — if the user resumes typing
  // while a GET is in flight (routinely: it's kicked off right as `dirty`
  // flips back to false after an apply, and a fast typist is already back in
  // the editor by the time it resolves), applying its response would replace
  // newer local text with the older snapshot the request actually asked for
  // — the diff in `setTextPreservingView` would compute a stale edit against
  // text the user has since moved past, clobbering what they just typed.
  // Checking `dirty` live (a ref, since the effect that fires refetch closes
  // over a stale value) at resolution time drops that response instead of
  // applying it; the debounce this new keystroke started will re-sync and
  // re-refetch shortly with the newer text included.
  const dirtyRef = useRef(dirty);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Server-reformatted DBML replaces the editor's content on every sync (own
  // edits included, once the debounce round-trips) — this fires on basically
  // every typing pause, so how the replace lands matters a lot.
  //
  // A first version of this replaced the *entire* buffer and then manually
  // snapshotted/restored the view state (cursor, selection, scroll) around
  // it. That looked like it preserved the cursor, but restoreViewState just
  // reapplies the *old* line/column numbers onto the *new* text — if the
  // reformat shifted anything before that position (reordered fields,
  // different indentation, a resolved reference), the same coordinates now
  // point at different content. That's what caused the cursor to visibly
  // "jump" mid-type, and — worse — it collapsed any in-progress selection on
  // every sync, which is exactly what made ctrl+shift+arrow selection feel
  // broken: the selection kept getting wiped out from under the user a
  // fraction of a second after they made it.
  //
  // Fix: only touch the *minimal* differing region (a plain prefix/suffix
  // diff — reformatting is almost always a small localized change, not a
  // full rewrite) and apply it via a single `executeEdits` range. Monaco
  // already knows how to shift a cursor/selection around an edit that
  // doesn't overlap it, so as long as the diffed range stays away from
  // wherever the user actually is, their cursor and selection are simply
  // left alone — no snapshot/restore needed at all.
  //
  // The server always emits LF, but Monaco's default model EOL is CRLF on
  // Windows — left unnormalized, that alone makes every single refetch look
  // "changed" and forces a replace even when nothing meaningful did.
  // Normalizing to the model's own EOL first means a same-content sync is a
  // true no-op, and keeps `text` state in the model's EOL convention so the
  // Editor's own controlled-value diff doesn't independently detect a
  // (spurious) mismatch and redo the replace itself.
  const setTextPreservingView = (next: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      setText(next);
      return;
    }
    const normalized = next.replace(/\r\n|\n/g, model.getEOL());
    const current = model.getValue();
    const diff = minimalDiffRange(current, normalized);
    if (diff) {
      suppressNextChangeRef.current = true;
      const range = monaco.Range.fromPositions(model.getPositionAt(diff.start), model.getPositionAt(diff.end));
      editor.executeEdits("remote-sync", [{ range, text: diff.text }]);
    }
    setText(normalized);
  };

  const refetch = () => {
    fetch(`/api/projects/${projectId}/export/dbml`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
      .then((dbml) => {
        if (dirtyRef.current) return;
        setTextPreservingView(dbml);
        setStatus("synced");
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) refetch();
    // project is a new object on every doc change (see useProjectDoc), so it's
    // exactly the "something changed remotely" signal this should refetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dirty]);

  const applyNow = useCallback(
    (source: string) => {
      setStatus("syncing");
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
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            automaticLayout: true,
            padding: { top: 10 },
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            // Default true: Monaco strips indentation off a blank line the
            // moment the cursor leaves it. Indent, Enter to leave a blank
            // line for later, move away — comes back unindented. Off.
            trimAutoWhitespace: false,
          }}
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
