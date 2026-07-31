import { ArchiveIcon, FolderIcon, PencilIcon, RestoreIcon, TrashIcon, UsersIcon } from "../Icons.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";
import { INPUT_SM_CLASS } from "../ui/inputStyles.js";
import type { ProjectStatus, ProjectSummary } from "../types.js";

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

  return (
    <div
      className={`group block w-full rounded-md border border-border bg-surface p-4 text-left shadow-xs transition-[box-shadow,transform,border-color] duration-150 ${
        openable ? "cursor-pointer hover:-translate-y-px hover:border-border-strong hover:shadow-md" : "cursor-default"
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
      <div className="flex items-start justify-between">
        <span className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-sm bg-primary-light text-primary">
          <FolderIcon size={17} />
        </span>
        {/* Server re-checks every mutating call regardless — this is UX only, never the security boundary. */}
        {p.permission === "administrator" && (
          <div className="flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {section === "trashed" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-tooltip="Restore to projects"
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
                  data-tooltip="Delete forever"
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
                  data-tooltip="Rename project"
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
                  data-tooltip="Manage teams"
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
                    data-tooltip="Restore to projects"
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
                    data-tooltip="Archive project"
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
                  data-tooltip="Move to trash"
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
      {isRenaming ? (
        <input
          autoFocus
          className={`${INPUT_SM_CLASS} mb-0.5 w-full font-semibold`}
          value={props.nameDraft}
          maxLength={200}
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
          data-tooltip={openable ? "Double-click to rename" : undefined}
          onDoubleClick={(e) => {
            if (!openable) return;
            e.stopPropagation();
            props.onStartRename();
          }}
        >
          {p.name}
        </div>
      )}
      <div className="text-xs text-text-muted">
        {p.created_at}
        {p.permission === "view" && <Badge tone="muted" className="ml-2">View only</Badge>}
      </div>
    </div>
  );
}
