import { useEffect, useState } from "react";
import { Modal } from "./Modal.js";
import { PlusIcon, TrashIcon } from "./Icons.js";
import type { PermissionLevel, ProjectSummary, ProjectTeamGrant, TeamSummary } from "./types.js";

const PERMISSION_LEVELS: PermissionLevel[] = ["view", "edit", "administrator"];

/** Assigns teams (+ a permission level each) to a project — reachable by anyone who can manage that project, not just global admins. */
function ProjectTeamsModal(props: { project: ProjectSummary; onClose: () => void }) {
  const [grants, setGrants] = useState<ProjectTeamGrant[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [pickTeamId, setPickTeamId] = useState("");
  const [pickPermission, setPickPermission] = useState<PermissionLevel>("view");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    fetch(`/api/projects/${props.project.id}/teams`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`load failed (${r.status})`))))
      .then(setGrants)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(refresh, [props.project.id]);
  useEffect(() => {
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTeams)
      .catch(() => {});
  }, []);

  const assign = async () => {
    if (!pickTeamId) return;
    const res = await fetch(`/api/projects/${props.project.id}/teams/${pickTeamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission: pickPermission }),
    });
    if (res.ok) {
      setPickTeamId("");
      refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Assign failed (${res.status})`);
    }
  };

  const unassign = async (teamId: string) => {
    await fetch(`/api/projects/${props.project.id}/teams/${teamId}`, { method: "DELETE" });
    refresh();
  };

  const setPermission = async (teamId: string, permission: PermissionLevel) => {
    await fetch(`/api/projects/${props.project.id}/teams/${teamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission }),
    });
    refresh();
  };

  const availableTeams = teams.filter((t) => !grants.some((g) => g.teamId === t.id));

  return (
    <Modal title={`Teams — ${props.project.name}`} onClose={props.onClose}>
      <p className="modal-hint">
        A project with no team assigned is visible to everyone. Assigning a team restricts it to that team's members
        (plus the creator and admins).
      </p>
      <div className="project-create-row">
        <select className="select" value={pickTeamId} onChange={(e) => setPickTeamId(e.target.value)}>
          <option value="">Assign a team…</option>
          {availableTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="select" value={pickPermission} onChange={(e) => setPickPermission(e.target.value as PermissionLevel)}>
          {PERMISSION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={assign} disabled={!pickTeamId}>
          <PlusIcon size={14} /> Assign
        </button>
      </div>
      {error && <div className="modal-error">{error}</div>}
      {grants.length === 0 ? (
        <div className="empty-state">No teams assigned — visible to everyone.</div>
      ) : (
        <div className="admin-list">
          {grants.map((g) => (
            <div key={g.teamId} className="admin-list-row">
              <div className="admin-list-main">
                <span>{g.teamName}</span>
              </div>
              <select
                className="select"
                value={g.permission}
                onChange={(e) => setPermission(g.teamId, e.target.value as PermissionLevel)}
              >
                {PERMISSION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <button className="btn btn-icon btn-ghost" title="Unassign" onClick={() => unassign(g.teamId)}>
                <TrashIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export { ProjectTeamsModal };
export default ProjectTeamsModal;
