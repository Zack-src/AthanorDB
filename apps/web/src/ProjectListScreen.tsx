import { useState } from "react";
import { ProjectList } from "./ProjectList.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import { DisplayNameField } from "./DisplayNameField.js";
import { KeyIcon, LogOutIcon, UsersIcon } from "./Icons.js";
import { Button } from "./ui/Button.js";
import { BrandMark } from "./ui/BrandMark.js";
import { StatusPill } from "./ui/StatusPill.js";
import { ErrorText } from "./ui/Alert.js";
import { APP_HEADER, APP_SHELL, TOOLBAR_SPACER } from "./ui/layout.js";
import type { ProjectStatus, ProjectSummary, Session } from "./types.js";

export interface ProjectListScreenProps {
  session: Session;
  serverStatus: "checking" | "ok" | "down";
  projects: ProjectSummary[];
  openLinkError: string | null;
  onOpenProject: (p: ProjectSummary) => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onDisplayNameChange: (name: string) => void;
  onCreateProject: (name: string) => Promise<string | null>;
  onRenameProject: (p: ProjectSummary, name: string) => Promise<void>;
  onSetProjectStatus: (p: ProjectSummary, status: ProjectStatus) => Promise<void>;
  onDeleteProjectForever: (p: ProjectSummary) => Promise<string | null>;
  onEmptyTrash: (items: ProjectSummary[]) => Promise<string | null>;
}

/** The signed-in "no project open" screen: header (brand/status/admin/account) plus the project list itself. */
export function ProjectListScreen(props: ProjectListScreenProps) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreateError(null);
    const error = await props.onCreateProject(name);
    if (error) setCreateError(error);
    else setNewName("");
  };

  return (
    <div className={APP_SHELL}>
      <header className={APP_HEADER}>
        <div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em] text-text">
          <BrandMark />
          AthanorDB
        </div>
        <StatusPill status={props.serverStatus} />
        <span className={TOOLBAR_SPACER} />
        {props.session.isAdmin && (
          <Button size="sm" onClick={props.onOpenAdmin} data-tooltip="Admin console" data-tooltip-pos="bottom">
            <UsersIcon size={13} /> Admin
          </Button>
        )}
        <DisplayNameField value={props.session.displayName} onCommit={props.onDisplayNameChange} />
        <Button variant="ghost" size="icon" onClick={() => setShowChangePassword(true)} data-tooltip="Change password" data-tooltip-pos="bottom">
          <KeyIcon size={14} />
        </Button>
        <Button variant="ghost" size="icon" onClick={props.onLogout} data-tooltip="Log out" data-tooltip-pos="bottom">
          <LogOutIcon size={15} />
        </Button>
      </header>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {props.openLinkError && <ErrorText>{props.openLinkError}</ErrorText>}
      <div className="min-h-0 flex-1">
        <ProjectList
          projects={props.projects}
          newName={newName}
          onNewNameChange={(v) => {
            setNewName(v);
            setCreateError(null);
          }}
          onCreate={handleCreate}
          createError={createError}
          onOpen={props.onOpenProject}
          onRename={props.onRenameProject}
          onSetStatus={props.onSetProjectStatus}
          onDeleteForever={props.onDeleteProjectForever}
          onEmptyTrash={props.onEmptyTrash}
        />
      </div>
    </div>
  );
}
