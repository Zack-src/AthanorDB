import { useState } from "react";
import { ProjectList } from "./ProjectList.js";
import { Navbar } from "./Navbar.js";
import { SettingsModal } from "./SettingsModal.js";
import { ErrorText } from "./ui/Alert.js";
import { APP_SHELL } from "./ui/layout.js";
import type { ProjectStatus, ProjectSummary, Session } from "./types.js";

export interface ProjectListScreenProps {
  session: Session;
  serverStatus: "checking" | "ok" | "down";
  projects: ProjectSummary[];
  openLinkError: string | null;
  onOpenProject: (p: ProjectSummary) => void;
  onOpenAdmin: () => void;
  onOpenLanding?: () => void;
  onOpenSettings?: () => void;
  onLogout: () => void;
  onDisplayNameChange: (name: string) => void;
  onCreateProject: (name: string) => Promise<string | null>;
  onRenameProject: (p: ProjectSummary, name: string) => Promise<void>;
  onSetProjectStatus: (p: ProjectSummary, status: ProjectStatus) => Promise<void>;
  onDeleteProjectForever: (p: ProjectSummary) => Promise<string | null>;
  onEmptyTrash: (items: ProjectSummary[]) => Promise<string | null>;
}

export function ProjectListScreen(props: ProjectListScreenProps) {
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
      <Navbar
        session={props.session}
        serverStatus={props.serverStatus}
        onOpenLanding={props.onOpenLanding}
        onOpenSettings={props.onOpenSettings}
        onOpenAdmin={props.onOpenAdmin}
      />


      {props.openLinkError && (
        <div className="p-4">
          <ErrorText>{props.openLinkError}</ErrorText>
        </div>
      )}

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
