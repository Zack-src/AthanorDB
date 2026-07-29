import { useState } from "react";
import { ArchiveIcon, FolderIcon, PencilIcon, PlusIcon, RestoreIcon, TrashIcon, UsersIcon } from "./Icons.js";
import { Modal } from "./Modal.js";
import { ProjectTeamsModal } from "./ProjectTeamsModal.js";
import type { ProjectStatus, ProjectSummary } from "./types.js";

const SECTIONS: { key: ProjectStatus; label: string; empty: string }[] = [
  { key: "active", label: "Projects", empty: "No projects yet — create one above to get started." },
  { key: "archived", label: "Archive", empty: "Archive is empty." },
  { key: "trashed", label: "Trash", empty: "Trash is empty." },
];

export function ProjectList(props: {
  projects: ProjectSummary[];
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreate: () => void;
  onOpen: (p: ProjectSummary) => void;
  onRename: (p: ProjectSummary, name: string) => void;
  onSetStatus: (p: ProjectSummary, status: ProjectStatus) => void;
  onDeleteForever: (p: ProjectSummary) => Promise<string | null>;
}) {
  const { projects, newName, onNewNameChange, onCreate, onOpen, onRename, onSetStatus, onDeleteForever } = props;
  const [section, setSection] = useState<ProjectStatus>("active");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [teamsTarget, setTeamsTarget] = useState<ProjectSummary | null>(null);

  const startRename = (p: ProjectSummary) => {
    setRenamingId(p.id);
    setNameDraft(p.name);
  };

  const commitRename = (p: ProjectSummary) => {
    setRenamingId(null);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== p.name) onRename(p, trimmed);
  };

  const openDeleteConfirm = (p: ProjectSummary) => {
    setDeleteError(null);
    setDeleteTarget(p);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const err = await onDeleteForever(deleteTarget);
    setDeleteBusy(false);
    if (err) setDeleteError(err);
    else setDeleteTarget(null);
  };

  const current = SECTIONS.find((s) => s.key === section)!;
  const visible = projects.filter((p) => p.status === section);
  const openable = section !== "trashed";

  return (
    <div className="project-list-page">
      <div className="project-list-inner">
        <h1 className="project-list-heading">Projects</h1>
        <p className="project-list-sub">DBML-native schema diagrams, versioned and shared live.</p>
        <div className="project-create-row">
          <input
            className="input"
            placeholder="New project name"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            maxLength={200}
          />
          <button className="btn btn-primary" onClick={onCreate}>
            <PlusIcon size={14} /> Create
          </button>
        </div>
        <div className="project-tabs">
          {SECTIONS.map((s) => {
            const count = projects.filter((p) => p.status === s.key).length;
            return (
              <button
                key={s.key}
                className={`project-tab${section === s.key ? " project-tab-active" : ""}`}
                onClick={() => setSection(s.key)}
              >
                {s.label}
                {count > 0 && <span className="project-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">{current.empty}</div>
        ) : (
          <div className="project-grid">
            {visible.map((p) => {
              const renaming = renamingId === p.id;
              return (
                <div
                  key={p.id}
                  className={`project-card${openable ? "" : " project-card-static"}`}
                  role={openable ? "button" : undefined}
                  tabIndex={openable ? 0 : undefined}
                  onClick={() => openable && !renaming && onOpen(p)}
                  onKeyDown={(e) => {
                    if (!openable || renaming) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(p);
                    }
                  }}
                >
                  <div className="project-card-top">
                    <span className="project-card-icon">
                      <FolderIcon size={17} />
                    </span>
                    {/* Server re-checks every mutating call regardless — this is UX only, never the security boundary. */}
                    {p.permission === "administrator" && (
                      <div className="project-card-actions">
                        {section === "trashed" ? (
                          <>
                            <button
                              className="btn btn-icon btn-ghost project-card-action"
                              title="Restore to projects"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStatus(p, "active");
                              }}
                            >
                              <RestoreIcon size={13} />
                            </button>
                            <button
                              className="btn btn-icon btn-ghost project-card-action"
                              title="Delete forever"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteConfirm(p);
                              }}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-icon btn-ghost project-card-action"
                              title="Rename project"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(p);
                              }}
                            >
                              <PencilIcon size={13} />
                            </button>
                            <button
                              className="btn btn-icon btn-ghost project-card-action"
                              title="Manage teams"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTeamsTarget(p);
                              }}
                            >
                              <UsersIcon size={13} />
                            </button>
                            {section === "archived" ? (
                              <button
                                className="btn btn-icon btn-ghost project-card-action"
                                title="Restore to projects"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetStatus(p, "active");
                                }}
                              >
                                <RestoreIcon size={13} />
                              </button>
                            ) : (
                              <button
                                className="btn btn-icon btn-ghost project-card-action"
                                title="Archive project"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetStatus(p, "archived");
                                }}
                              >
                                <ArchiveIcon size={13} />
                              </button>
                            )}
                            <button
                              className="btn btn-icon btn-ghost project-card-action"
                              title="Move to trash"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetStatus(p, "trashed");
                              }}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {renaming ? (
                    <input
                      autoFocus
                      className="input project-card-name-input"
                      value={nameDraft}
                      maxLength={200}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => commitRename(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(p);
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenamingId(null);
                        }
                      }}
                    />
                  ) : (
                    <div
                      className="project-card-name"
                      title={openable ? "Double-click to rename" : undefined}
                      onDoubleClick={(e) => {
                        if (!openable) return;
                        e.stopPropagation();
                        startRename(p);
                      }}
                    >
                      {p.name}
                    </div>
                  )}
                  <div className="project-card-date">
                    {p.created_at}
                    {p.permission === "view" && <span className="badge-viewonly">View only</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {deleteTarget && (
        <Modal title="Delete project forever" onClose={() => setDeleteTarget(null)}>
          <p className="modal-hint">
            Permanently delete <strong>{deleteTarget.name}</strong>? This removes its whole revision history too, and
            can't be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
          {deleteError && <div className="modal-error">{deleteError}</div>}
        </Modal>
      )}
      {teamsTarget && <ProjectTeamsModal project={teamsTarget} onClose={() => setTeamsTarget(null)} />}
    </div>
  );
}
