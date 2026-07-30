import { useState } from "react";
import "@xyflow/react/dist/style.css";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProjectRouting } from "./hooks/useProjectRouting.js";
import { ProjectEditor } from "./ProjectEditor.js";
import { ProjectListScreen } from "./ProjectListScreen.js";
import { Login } from "./Login.js";
import { AcceptInvite } from "./AcceptInvite.js";
import { AdminConsole } from "./AdminConsole.js";

export function App() {
  const [adminOpen, setAdminOpen] = useState(false);

  const { session, setSession, serverStatus, logout, updateDisplayName } = useAuthSession(() => {
    setAdminOpen(false);
    routing.reset();
  });
  const projectsHandle = useProjects(Boolean(session && session !== "loading"));
  const routing = useProjectRouting(session, projectsHandle.projects);

  if (routing.inviteToken) {
    return (
      <div className="flex h-screen w-screen flex-col bg-bg">
        <AcceptInvite
          token={routing.inviteToken}
          onLoggedIn={(s) => {
            setSession(s);
            window.history.replaceState(null, "", "/");
          }}
        />
      </div>
    );
  }

  if (session === "loading") {
    return <div className="flex h-screen w-screen flex-col bg-bg" />;
  }

  if (!session) {
    return (
      <div className="flex h-screen w-screen flex-col bg-bg">
        <Login onLoggedIn={setSession} />
      </div>
    );
  }

  if (adminOpen) {
    return <AdminConsole onClose={() => setAdminOpen(false)} />;
  }

  if (routing.openProject) {
    return (
      <div className="flex h-screen w-screen flex-col bg-bg">
        <ProjectEditor
          project={routing.openProject}
          user={session.displayName}
          userId={session.id}
          onDisplayNameChange={updateDisplayName}
          onBack={routing.closeProject}
        />
      </div>
    );
  }

  return (
    <ProjectListScreen
      session={session}
      serverStatus={serverStatus}
      projects={projectsHandle.projects}
      openLinkError={routing.openLinkError}
      onOpenProject={routing.openProjectAndNavigate}
      onOpenAdmin={() => setAdminOpen(true)}
      onLogout={logout}
      onDisplayNameChange={updateDisplayName}
      onCreateProject={projectsHandle.createProject}
      onRenameProject={projectsHandle.renameProject}
      onSetProjectStatus={projectsHandle.setProjectStatus}
      onDeleteProjectForever={projectsHandle.deleteProjectForever}
      onEmptyTrash={projectsHandle.emptyTrash}
    />
  );
}
