import { useEffect, useRef, useState } from "react";
import type { Project, RevisionMeta } from "@athanordb/shared";
import { diffProjects, type ChangeStatus, type ProjectDiff } from "@athanordb/dbml-engine";
import { Modal } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { ErrorText } from "./ui/Alert.js";
import { INPUT_CLASS, TEXTAREA_CODE_CLASS } from "./ui/inputStyles.js";

const DIFF_ROW_CLASS: Record<ChangeStatus, string> = {
  added: "text-success",
  removed: "text-danger",
  changed: "text-warning",
};
const DIFF_SIGN: Record<ChangeStatus, string> = { added: "+", removed: "-", changed: "~" };

function DiffSummary(props: { diff: ProjectDiff }) {
  const { tables, refs } = props.diff;
  if (tables.length === 0 && refs.length === 0) {
    return <div className="text-xs text-text-muted">No schema changes since this revision.</div>;
  }
  return (
    <div>
      {tables.map((t) => (
        <div key={t.id} className={`font-mono text-xs leading-relaxed ${DIFF_ROW_CLASS[t.status]}`}>
          {DIFF_SIGN[t.status]} Table {t.renamedFrom ? `${t.renamedFrom} → ${t.name}` : t.name}
          {t.fields.length > 0 && (
            <span className="text-text-muted"> ({t.fields.map((f) => `${DIFF_SIGN[f.status]}${f.name}`).join(", ")})</span>
          )}
        </div>
      ))}
      {refs.map((r) => (
        <div key={r.id} className={`font-mono text-xs leading-relaxed ${DIFF_ROW_CLASS[r.status]}`}>
          {DIFF_SIGN[r.status]} Ref{(r.after ?? r.before)?.name ? ` ${(r.after ?? r.before)!.name}` : ""}
        </div>
      ))}
    </div>
  );
}

/**
 * Revision timeline: list of past revisions (author + timestamp), DBML
 * preview of whichever one is selected (via the export-at-revision route,
 * mirroring `reconstructDocAtRevision`), a schema-level diff against the
 * current live state (`diffProjects` — safe to use client-side, unlike
 * `dbml.ts`'s exports, since it has no `@dbml/core` import to drag in), and a
 * restore button hitting the existing non-destructive restore endpoint
 * (creates a new revision rather than rewriting history).
 */
function HistoryPanel(props: { projectId: string; currentProject: Project; onClose: () => void }) {
  const [revisions, setRevisions] = useState<RevisionMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [diff, setDiff] = useState<ProjectDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${props.projectId}/revisions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`list failed (${res.status})`))))
      .then((revs: RevisionMeta[]) => {
        setRevisions(revs);
        if (revs.length > 0) setSelectedId(revs[revs.length - 1].id);
      })
      .catch((err) => setError((err as Error).message));
  }, [props.projectId]);

  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this same effect kicks off
    setBusy(true);
    Promise.all([
      fetch(`/api/projects/${props.projectId}/revisions/${selectedId}/export/dbml`).then((res) =>
        res.ok ? res.text() : Promise.reject(new Error(`preview failed (${res.status})`)),
      ),
      fetch(`/api/projects/${props.projectId}/revisions/${selectedId}`).then((res) =>
        res.ok ? (res.json() as Promise<Project>) : Promise.reject(new Error(`diff fetch failed (${res.status})`)),
      ),
    ])
      .then(([dbml, revisionProject]) => {
        setPreview(dbml);
        setDiff(diffProjects(revisionProject, props.currentProject));
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
    // currentProject deliberately excluded: it's a new object on every doc
    // change, and re-diffing on every remote edit while the panel is open
    // would be noisy — the comparison point is "this revision vs. what's on
    // screen when I opened the panel / picked this revision".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, props.projectId]);

  const saveLabel = async () => {
    if (!selectedId || !labelInputRef.current) return;
    const label = labelInputRef.current.value.trim();
    setSavingLabel(true);
    try {
      const res = await fetch(`/api/projects/${props.projectId}/revisions/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || null }),
      });
      if (res.ok) {
        setRevisions((revs) => revs.map((r) => (r.id === selectedId ? { ...r, label: label || null } : r)));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Label failed (${res.status})`);
      }
    } finally {
      setSavingLabel(false);
    }
  };

  const restore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/projects/${props.projectId}/revisions/${selectedId}/restore`, { method: "POST" });
      if (res.ok) {
        props.onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Restore failed (${res.status})`);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal title="History" onClose={props.onClose} wide>
      <div className="flex h-[440px]">
        <ul className="w-[210px] shrink-0 list-none overflow-y-auto border-r border-border p-1.5 m-0">
          {revisions.map((rev) => (
            <li key={rev.id}>
              <button
                className={`mb-0.5 block w-full rounded-sm px-[9px] py-2 text-left transition-colors duration-100 hover:bg-surface-hover ${
                  rev.id === selectedId ? "!bg-primary-light" : ""
                }`}
                onClick={() => setSelectedId(rev.id)}
              >
                <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-text">
                  {rev.label ? `🏷 ${rev.label}` : rev.author}
                </div>
                <div className="mt-px text-[11px] text-text-muted">
                  {rev.label ? `${rev.author} · ${rev.createdAt}` : rev.createdAt}
                </div>
              </button>
            </li>
          ))}
          {revisions.length === 0 && <li className="p-2 text-xs text-text-muted">No revisions yet.</li>}
        </ul>
        <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-1 gap-1.5">
              <input
                key={selectedId}
                ref={labelInputRef}
                className={`${INPUT_CLASS} flex-1`}
                defaultValue={revisions.find((r) => r.id === selectedId)?.label ?? ""}
                placeholder="Checkpoint name (e.g. v1.0)"
                disabled={!selectedId}
              />
              <Button size="sm" onClick={saveLabel} disabled={!selectedId || savingLabel}>
                {savingLabel ? "Saving…" : "Label"}
              </Button>
            </div>
            <Button variant="primary" size="sm" onClick={restore} disabled={!selectedId || restoring}>
              {restoring ? "Restoring…" : "Restore this revision"}
            </Button>
          </div>
          <div className="mb-2.5 max-h-[120px] overflow-y-auto rounded-sm border border-border bg-[var(--color-bg-canvas)] px-2.5 py-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
              Changes since this revision
            </div>
            {busy ? <div className="text-xs text-text-muted">Loading…</div> : diff && <DiffSummary diff={diff} />}
          </div>
          <textarea readOnly className={`${TEXTAREA_CODE_CLASS} flex-1`} value={busy ? "Loading…" : preview} />
        </div>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </Modal>
  );
}

export { HistoryPanel };
export default HistoryPanel;
