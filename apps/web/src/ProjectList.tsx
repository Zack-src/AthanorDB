import { useState } from "react";
import { MAX_NAME_LENGTH } from "@athanordb/shared";
import { FolderIcon, PlusIcon, TrashIcon } from "./Icons.js";
import { ProjectTeamsModal } from "./ProjectTeamsModal.js";
import { PROJECT_SECTIONS, ProjectTabs } from "./projectList/ProjectTabs.js";
import { ProjectCard } from "./projectList/ProjectCard.js";
import { DeleteProjectModal } from "./projectList/DeleteProjectModal.js";
import { EmptyTrashModal } from "./projectList/EmptyTrashModal.js";
import { Button } from "./ui/Button.js";
import { ErrorText } from "./ui/Alert.js";
import { EmptyState } from "./ui/List.js";
import { Input } from "./ui/Input.js";
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
  const [searchQuery, setSearchQuery] = useState("");
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
  const visible = projects
    .filter((p) => p.status === section)
    .filter((p) => (searchQuery.trim() ? p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) : true));
  const openable = section !== "trashed";
  const trashedDeletable = projects.filter((p) => p.status === "trashed" && p.permission === "administrator");

  const confirmEmptyTrash = async () => {
    setEmptyTrashBusy(true);
    const err = await onEmptyTrash(trashedDeletable);
    setEmptyTrashBusy(false);
    if (err) setEmptyTrashError(err);
    else setEmptyTrashOpen(false);
  };

  const handleInstantCreate = async () => {
    const name = newName.trim() || `Nouveau Schéma ${projects.length + 1}`;
    onNewNameChange(name);
    onCreate();
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-[920px]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Mes Schémas DBML</h1>
            <p className="text-xs text-text-muted mt-1">Diagrammes de bases de données versionnés et synchronisés en direct.</p>
          </div>

          {/* Create & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input
              wrapperClassName="w-full sm:w-56"
              placeholder="Rechercher un schéma…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="primary" onClick={handleInstantCreate} className="w-full sm:w-auto px-4 py-2 gap-2 text-xs">
              <PlusIcon size={15} /> Nouveau projet
            </Button>
          </div>
        </div>


        {createError && <ErrorText>{createError}</ErrorText>}
        <ProjectTabs projects={projects} section={section} onSectionChange={setSection} />
        {section === "trashed" && trashedDeletable.length > 0 && (
          <div className="mb-3 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setEmptyTrashError(null);
                setEmptyTrashOpen(true);
              }}
            >
              <TrashIcon size={13} /> Vider la corbeille ({trashedDeletable.length})
            </Button>
          </div>
        )}
        {visible.length === 0 ? (
          <EmptyState>{searchQuery.trim() ? "Aucun projet ne correspond à votre recherche." : current.empty}</EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
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
