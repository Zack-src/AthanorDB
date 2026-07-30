import { useEffect, useState } from "react";
import type { ProjectSummary, Session } from "../types.js";

export interface ProjectRoutingHandle {
  inviteToken: string | null;
  initialProjectId: string | null;
  openProject: ProjectSummary | null;
  openLinkError: string | null;
  openProjectAndNavigate: (p: ProjectSummary) => void;
  closeProject: () => void;
  reset: () => void;
}

/**
 * Owns the app's "no router" URL sync: `/invite/:token` and `/project/:id`
 * are the only paths treated as real URLs (read once at mount), everything
 * else is in-memory state pushed/replaced into `history` so a bookmarked or
 * shared project link still works and back/forward behaves as expected.
 */
export function useProjectRouting(session: Session | null | "loading", projects: ProjectSummary[]): ProjectRoutingHandle {
  const [inviteToken] = useState(() => location.pathname.match(/^\/invite\/([^/]+)$/)?.[1] ?? null);
  const [initialProjectId] = useState(() => location.pathname.match(/^\/project\/([^/]+)$/)?.[1] ?? null);
  const [openProject, setOpenProject] = useState<ProjectSummary | null>(null);
  const [openLinkError, setOpenLinkError] = useState<string | null>(null);

  const openProjectAndNavigate = (p: ProjectSummary) => {
    setOpenLinkError(null);
    setOpenProject(p);
    history.pushState(null, "", `/project/${p.id}`);
  };

  const closeProject = () => {
    setOpenProject(null);
    history.pushState(null, "", "/");
  };

  const reset = () => {
    setOpenProject(null);
    history.replaceState(null, "", "/");
  };

  // Resolves a deep-linked `/project/:id` once we know who's logged in — the
  // project-list fetch races this, so this asks the server directly rather
  // than waiting on it (and the endpoint enforces permission either way).
  useEffect(() => {
    if (!initialProjectId || !session || session === "loading" || openProject) return;
    fetch(`/api/projects/${initialProjectId}`)
      .then(async (r) => {
        if (r.ok) {
          setOpenProject(await r.json());
          return;
        }
        history.replaceState(null, "", "/");
        setOpenLinkError(
          r.status === 404 ? "That project no longer exists." : "You don't have access to that project.",
        );
      })
      .catch(() => history.replaceState(null, "", "/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, session]);

  // Mirrors browser back/forward on `/project/:id` <-> `/` to in-memory state.
  useEffect(() => {
    const onPopState = () => {
      const id = location.pathname.match(/^\/project\/([^/]+)$/)?.[1] ?? null;
      if (!id) {
        setOpenProject(null);
        return;
      }
      const found = projects.find((p) => p.id === id);
      if (found) {
        setOpenProject(found);
        return;
      }
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => setOpenProject(p))
        .catch(() => setOpenProject(null));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [projects]);

  useEffect(() => {
    document.title = openProject ? `${openProject.name} · AthanorDB` : "AthanorDB";
  }, [openProject]);

  return { inviteToken, initialProjectId, openProject, openLinkError, openProjectAndNavigate, closeProject, reset };
}
