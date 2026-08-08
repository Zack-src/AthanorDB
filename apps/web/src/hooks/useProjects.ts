import { useCallback, useEffect, useState } from "react";
import type { ProjectStatus, ProjectSummary } from "../types.js";

export interface ProjectsHandle {
  projects: ProjectSummary[];
  refreshProjects: () => void;
  createProject: (name: string) => Promise<string | null>;
  renameProject: (p: ProjectSummary, name: string) => Promise<void>;
  setProjectStatus: (p: ProjectSummary, status: ProjectStatus) => Promise<void>;
  deleteProjectForever: (p: ProjectSummary) => Promise<string | null>;
  emptyTrash: (items: ProjectSummary[]) => Promise<string | null>;
}

/** Stable empty array, so a logged-out render doesn't hand consumers a new identity every time. */
const EMPTY_PROJECTS: ProjectSummary[] = [];

/** Owns the project-list CRUD calls; `active` gates the initial fetch on being logged in. */
export function useProjects(active: boolean): ProjectsHandle {
  const [fetched, setFetched] = useState<ProjectSummary[]>([]);

  const refreshProjects = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setFetched)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (active) refreshProjects();
  }, [active, refreshProjects]);

  // Logged out -> no projects, derived rather than cleared from an effect: the
  // fetched list is simply not shown, and it is refetched on the next login.
  const projects = active ? fetched : EMPTY_PROJECTS;

  const createProject = async (name: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        refreshProjects();
        return null;
      }
      const data = await res.json().catch(() => ({}));
      return data.error ?? `Create failed (${res.status})`;
    } catch (err) {
      return err instanceof Error ? err.message : "Network error";
    }
  };

  const renameProject = async (p: ProjectSummary, name: string) => {
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) refreshProjects();
  };

  const setProjectStatus = async (p: ProjectSummary, status: ProjectStatus) => {
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) refreshProjects();
  };

  const deleteProjectForever = async (p: ProjectSummary): Promise<string | null> => {
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      refreshProjects();
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.error ?? `Delete failed (${res.status})`;
  };

  const emptyTrash = async (items: ProjectSummary[]): Promise<string | null> => {
    const results = await Promise.all(items.map((p) => fetch(`/api/projects/${p.id}`, { method: "DELETE" })));
    refreshProjects();
    const failedCount = results.filter((r) => !r.ok).length;
    return failedCount > 0 ? `${failedCount} project(s) could not be deleted.` : null;
  };

  return { projects, refreshProjects, createProject, renameProject, setProjectStatus, deleteProjectForever, emptyTrash };
}
