import { useEffect, useRef, useState } from "react";
import type { Project, RevisionMeta } from "@athanordb/shared";
import { diffProjects, type ChangeStatus, type ProjectDiff } from "@athanordb/dbml-engine";
import { Modal } from "./Modal.js";

const DIFF_ROW_CLASS: Record<ChangeStatus, string> = {
  added: "diff-added",
  removed: "diff-removed",
  changed: "diff-changed",
};
const DIFF_SIGN: Record<ChangeStatus, string> = { added: "+", removed: "-", changed: "~" };

function DiffSummary(props: { diff: ProjectDiff }) {
  const { tables, refs } = props.diff;
  if (tables.length === 0 && refs.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No schema changes since this revision.</div>;
  }
  return (
    <div>
      {tables.map((t) => (
        <div key={t.id} className={`diff-row ${DIFF_ROW_CLASS[t.status]}`}>
          {DIFF_SIGN[t.status]} Table {t.renamedFrom ? `${t.renamedFrom} → ${t.name}` : t.name}
          {t.fields.length > 0 && (
            <span style={{ color: "var(--color-text-muted)" }}>
              {" "}
              ({t.fields.map((f) => `${DIFF_SIGN[f.status]}${f.name}`).join(", ")})
            </span>
          )}
        </div>
      ))}
      {refs.map((r) => (
        <div key={r.id} className={`diff-row ${DIFF_ROW_CLASS[r.status]}`}>
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
function HistoryPanel(props: { projectId: string; currentProject: Project; user: string; onClose: () => void }) {
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
      const res = await fetch(
        `/api/projects/${props.projectId}/revisions/${selectedId}/restore?user=${encodeURIComponent(props.user)}`,
        { method: "POST" },
      );
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
      <div className="history-layout">
        <ul className="history-list">
          {revisions.map((rev) => (
            <li key={rev.id}>
              <button
                className={`history-item${rev.id === selectedId ? " history-item-active" : ""}`}
                onClick={() => setSelectedId(rev.id)}
              >
                <div className="history-item-title">{rev.label ? `🏷 ${rev.label}` : rev.author}</div>
                <div className="history-item-sub">
                  {rev.label ? `${rev.author} · ${rev.createdAt}` : rev.createdAt}
                </div>
              </button>
            </li>
          ))}
          {revisions.length === 0 && (
            <li style={{ padding: 8, color: "var(--color-text-muted)", fontSize: 12 }}>No revisions yet.</li>
          )}
        </ul>
        <div className="history-detail">
          <div className="history-detail-toolbar">
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                key={selectedId}
                ref={labelInputRef}
                className="input"
                defaultValue={revisions.find((r) => r.id === selectedId)?.label ?? ""}
                placeholder="Checkpoint name (e.g. v1.0)"
                disabled={!selectedId}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={saveLabel} disabled={!selectedId || savingLabel}>
                {savingLabel ? "Saving…" : "Label"}
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={restore} disabled={!selectedId || restoring}>
              {restoring ? "Restoring…" : "Restore this revision"}
            </button>
          </div>
          <div className="history-diff-box">
            <div className="history-diff-title">Changes since this revision</div>
            {busy ? (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading…</div>
            ) : (
              diff && <DiffSummary diff={diff} />
            )}
          </div>
          <textarea
            readOnly
            className="textarea textarea-code"
            value={busy ? "Loading…" : preview}
            style={{ flex: 1 }}
          />
        </div>
      </div>
      {error && <div className="modal-error">{error}</div>}
    </Modal>
  );
}

export { HistoryPanel };
export default HistoryPanel;
