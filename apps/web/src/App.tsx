import { useState } from "react";
import "@xyflow/react/dist/style.css";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProjectRouting } from "./hooks/useProjectRouting.js";
import { ProjectEditor } from "./ProjectEditor.js";
import { ProjectListScreen } from "./ProjectListScreen.js";
import { Login } from "./Login.js";
import { LandingPage } from "./LandingPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { AcceptInvite } from "./AcceptInvite.js";
import { AdminConsole } from "./AdminConsole.js";
import { APP_SHELL } from "./ui/layout.js";

export function App() {
  const [adminOpen, setAdminOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"landing" | "app" | "login" | "settings">(() => {
    // If opening a direct project URL or invite link, default to app view mode
    if (location.pathname.startsWith("/project/") || location.pathname.startsWith("/invite/")) {
      return "app";
    }
    return "landing";
  });

  const { session, setSession, serverStatus, logout, updateDisplayName } = useAuthSession(() => setAdminOpen(false));
  const projectsHandle = useProjects(Boolean(session && session !== "loading"));
  const routing = useProjectRouting(session, projectsHandle.projects);

  if (routing.inviteToken) {
    return (
      <div className={APP_SHELL}>
        <AcceptInvite
          token={routing.inviteToken}
          onLoggedIn={(s) => {
            setSession(s);
            setViewMode("app");
            window.history.replaceState(null, "", "/");
          }}
        />
      </div>
    );
  }

  if (session === "loading") {
    return <div className={APP_SHELL} />;
  }

  // 1. Direct Open Project takes precedence if a project is loaded and user is authenticated
  if (routing.openProject && session) {
    return (
      <div className={APP_SHELL}>
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

  // 2. Direct project URL accessed by non-authenticated user: prompt Login directly
  if (location.pathname.startsWith("/project/") && !session) {
    return (
      <Login
        onLoggedIn={(s) => {
          setSession(s);
          setViewMode("app");
        }}
        onBackToLanding={() => {
          window.history.pushState(null, "", "/");
          setViewMode("landing");
        }}
      />
    );
  }

  // 3. Settings View
  if (viewMode === "settings" && session) {
    return (
      <SettingsPage
        session={session}
        onBack={() => setViewMode("app")}
        onDisplayNameChange={updateDisplayName}
        onLogout={() => {
          logout();
          setViewMode("landing");
        }}
      />
    );
  }

  // 4. Admin Console View
  if (adminOpen && session) {
    return <AdminConsole onClose={() => setAdminOpen(false)} />;
  }

  // 5. Explicit Login View
  if (viewMode === "login" && !session) {
    return (
      <Login
        onLoggedIn={(s) => {
          setSession(s);
          setViewMode("app");
        }}
        onBackToLanding={() => setViewMode("landing")}
      />
    );
  }

  // 6. Explicit Landing Page View (when on root / or requested)
  if (viewMode === "landing" && !location.pathname.startsWith("/project/")) {
    return (
      <LandingPage
        isLoggedIn={Boolean(session)}
        onOpenApp={() => {
          if (!session) {
            setViewMode("login");
          } else {
            setViewMode("app");
          }
        }}
        onOpenLogin={() => setViewMode("login")}
      />
    );
  }

  // 7. Non-authenticated fallback -> Landing Page
  if (!session) {
    return (
      <LandingPage
        isLoggedIn={false}
        onOpenApp={() => setViewMode("login")}
        onOpenLogin={() => setViewMode("login")}
      />
    );
  }

  // 8. Default Workspace Dashboard View
  return (
    <ProjectListScreen
      session={session}
      serverStatus={serverStatus}
      projects={projectsHandle.projects}
      openLinkError={routing.openLinkError}
      onOpenProject={routing.openProjectAndNavigate}
      onOpenAdmin={() => setAdminOpen(true)}
      onOpenLanding={() => {
        window.history.pushState(null, "", "/");
        setViewMode("landing");
      }}
      onOpenSettings={() => setViewMode("settings")}
      onLogout={() => {
        logout();
        setViewMode("landing");
      }}
      onDisplayNameChange={updateDisplayName}
      onCreateProject={projectsHandle.createProject}
      onRenameProject={projectsHandle.renameProject}
      onSetProjectStatus={projectsHandle.setProjectStatus}
      onDeleteProjectForever={projectsHandle.deleteProjectForever}
      onEmptyTrash={projectsHandle.emptyTrash}
    />
  );
}
