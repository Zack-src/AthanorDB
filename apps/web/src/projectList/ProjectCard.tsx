import { MAX_NAME_LENGTH } from "@athanordb/shared";
import { ArchiveIcon, PencilIcon, RestoreIcon, TrashIcon, UsersIcon } from "../Icons.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";
import { INPUT_SM_CLASS } from "../ui/inputStyles.js";
import type { ProjectStatus, ProjectSummary } from "../types.js";

/** Cheap string hash — deterministic per project id, no crypto needed. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * A small abstract "schema" thumbnail generated from the project id — a few
 * rounded blocks over the same dot grid the real canvas uses. There's no
 * real preview to render (no thumbnail pipeline), so every card getting an
 * identical folder icon would read as flatter/more generic than the actual
 * product; this at least makes each tile visually distinct and echoes the
 * canvas it opens into.
 */
function ProjectThumbnail({ id, accent }: { id: string; accent: string }) {
  const h = hashOf(id);
  const blocks = [0, 1, 2].map((i) => {
    const seed = h >> (i * 6);
    return {
      w: 34 + (seed % 28),
      hgt: 16 + ((seed >> 3) % 14),
      x: 10 + ((seed >> 6) % 55),
      y: 10 + ((seed >> 9) % 45),
    };
  });
  return (
    <div
      className="relative h-[104px] w-full overflow-hidden bg-bg-canvas"
      style={{ backgroundImage: "radial-gradient(#292d3f 1px, transparent 1px)", backgroundSize: "12px 12px" }}
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(120px 80px at 20% 20%, ${accent}22, transparent)` }} />
      {blocks.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-md border"
          style={{
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.hgt,
            background: `${accent}1f`,
            borderColor: `${accent}55`,
          }}
        />
      ))}
    </div>
  );
}

const ACCENTS = ["#6366f1", "#a855f7", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

/** One project tile: open-on-click, plus the per-section action buttons (rename/teams/archive/restore/trash/delete) admins get. */
export function ProjectCard(props: {
  project: ProjectSummary;
  section: ProjectStatus;
  openable: boolean;
  isRenaming: boolean;
  nameDraft: string;
  onNameDraftChange: (v: string) => void;
  onOpen: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSetStatus: (status: ProjectStatus) => void;
  onDeleteForever: () => void;
  onManageTeams: () => void;
}) {
  const { project: p, section, openable, isRenaming } = props;
  const accent = ACCENTS[hashOf(p.id) % ACCENTS.length];

  return (
    <div
      className={`group block w-full overflow-hidden rounded-xl border border-border bg-surface text-left shadow-xs transition-[box-shadow,transform,border-color] duration-150 ${
        openable ? "cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg" : "cursor-default"
      }`}
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={() => openable && !isRenaming && props.onOpen()}
      onKeyDown={(e) => {
        if (!openable || isRenaming) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen();
        }
      }}
    >
      <ProjectThumbnail id={p.id} accent={accent} />

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <input
              autoFocus
              className={`${INPUT_SM_CLASS} mb-0.5 w-full font-semibold`}
              value={props.nameDraft}
              maxLength={MAX_NAME_LENGTH}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => props.onNameDraftChange(e.target.value)}
              onBlur={props.onCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onCommitRename();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  props.onCancelRename();
                }
              }}
            />
          ) : (
            <div
              className="mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-text"
              data-tooltip={openable ? "Double-cliquer pour renommer" : undefined}
              onDoubleClick={(e) => {
                if (!openable) return;
                e.stopPropagation();
                props.onStartRename();
              }}
            >
              {p.name}
            </div>
          )}

          {/* Server re-checks every mutating call regardless — this is UX only, never the security boundary. */}
          {p.permission === "administrator" && (
            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              {section === "trashed" ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-tooltip="Restaurer"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onSetStatus("active");
                    }}
                  >
                    <RestoreIcon size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-tooltip="Supprimer définitivement"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onDeleteForever();
                    }}
                  >
                    <TrashIcon size={13} />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-tooltip="Renommer"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onStartRename();
                    }}
                  >
                    <PencilIcon size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-tooltip="Gérer les équipes"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onManageTeams();
                    }}
                  >
                    <UsersIcon size={13} />
                  </Button>
                  {section === "archived" ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-tooltip="Restaurer"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onSetStatus("active");
                      }}
                    >
                      <RestoreIcon size={13} />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-tooltip="Archiver"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onSetStatus("archived");
                      }}
                    >
                      <ArchiveIcon size={13} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-tooltip="Mettre à la corbeille"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onSetStatus("trashed");
                    }}
                  >
                    <TrashIcon size={13} />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          Créé le {p.created_at}
          {p.permission === "view" && <Badge tone="muted" className="ml-1">Lecture seule</Badge>}
        </div>
      </div>
    </div>
  );
}
