import { useState } from "react";
import { PlusIcon, TrashIcon } from "./Icons.js";
import { ProjectTeamsModal } from "./ProjectTeamsModal.js";
import { PROJECT_SECTIONS, ProjectTabs } from "./projectList/ProjectTabs.js";
import { ProjectCard } from "./projectList/ProjectCard.js";
import { DeleteProjectModal } from "./projectList/DeleteProjectModal.js";
import { EmptyTrashModal } from "./projectList/EmptyTrashModal.js";
import { Button } from "./ui/Button.js";
import { ErrorText } from "./ui/Alert.js";
import { EmptyState } from "./ui/List.js";
import { INPUT_CLASS } from "./ui/inputStyles.js";
import type { ProjectStatus, ProjectSummary } from "./types.js";

export function ProjectList(props: {
  projects: ProjectSummary[];
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreate: () => void;
  createError: string | null;
  onOpen: (p: ProjectSummary) => void;
  onRename: (p: ProjectSummary, name: string) => void;
  onSetStatus: (p: ProjectSummary, status: ProjectStatus) => void;
  onDeleteForever: (p: ProjectSummary) => Promise<string | null>;
  onEmptyTrash: (projects: ProjectSummary[]) => Promise<string | null>;
}) {
  const { projects, newName, onNewNameChange, onCreate, createError, onOpen, onRename, onSetStatus, onDeleteForever, onEmptyTrash } =
    props;
  const [section, setSection] = useState<ProjectStatus>("active");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [teamsTarget, setTeamsTarget] = useState<ProjectSummary | null>(null);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [emptyTrashError, setEmptyTrashError] = useState<string | null>(null);
  const [emptyTrashBusy, setEmptyTrashBusy] = useState(false);

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

  const current = PROJECT_SECTIONS.find((s) => s.key === section)!;
  const visible = projects.filter((p) => p.status === section);
  const openable = section !== "trashed";
  // Only projects this user can actually hard-delete — mirrors the per-card
  // gating below, so "empty trash" never attempts a delete the server would
  // reject anyway.
  const trashedDeletable = projects.filter((p) => p.status === "trashed" && p.permission === "administrator");

  const confirmEmptyTrash = async () => {
    setEmptyTrashBusy(true);
    const err = await onEmptyTrash(trashedDeletable);
    setEmptyTrashBusy(false);
    if (err) setEmptyTrashError(err);
    else setEmptyTrashOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-12">
      <div className="mx-auto max-w-[880px]">
        <h1 className="mb-1 text-[22px] font-bold tracking-[-0.01em]">Projects</h1>
        <p className="mb-6 text-[13.5px] text-text-muted">DBML-native schema diagrams, versioned and shared live.</p>
        <div className="mb-7 flex max-w-[420px] gap-2">
          <input
            className={`${INPUT_CLASS} flex-1`}
            placeholder="New project name"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            maxLength={200}
          />
          <Button variant="primary" onClick={onCreate}>
            <PlusIcon size={14} /> Create
          </Button>
        </div>
        {createError && <ErrorText>{createError}</ErrorText>}
        <ProjectTabs projects={projects} section={section} onSectionChange={setSection} />
        {section === "trashed" && trashedDeletable.length > 0 && (
          <div className="mb-2 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setEmptyTrashError(null);
                setEmptyTrashOpen(true);
              }}
            >
              <TrashIcon size={13} /> Empty trash ({trashedDeletable.length})
            </Button>
          </div>
        )}
        {visible.length === 0 ? (
          <EmptyState>{current.empty}</EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                section={section}
                openable={openable}
                isRenaming={renamingId === p.id}
                nameDraft={nameDraft}
                onNameDraftChange={setNameDraft}
                onOpen={() => onOpen(p)}
                onStartRename={() => startRename(p)}
                onCommitRename={() => commitRename(p)}
                onCancelRename={() => setRenamingId(null)}
                onSetStatus={(status) => onSetStatus(p, status)}
                onDeleteForever={() => openDeleteConfirm(p)}
                onManageTeams={() => setTeamsTarget(p)}
              />
            ))}
          </div>
        )}
      </div>
      {deleteTarget && (
        <DeleteProjectModal
          target={deleteTarget}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {emptyTrashOpen && (
        <EmptyTrashModal
          count={trashedDeletable.length}
          busy={emptyTrashBusy}
          error={emptyTrashError}
          onConfirm={confirmEmptyTrash}
          onClose={() => setEmptyTrashOpen(false)}
        />
      )}
      {teamsTarget && <ProjectTeamsModal project={teamsTarget} onClose={() => setTeamsTarget(null)} />}
    </div>
  );
}
