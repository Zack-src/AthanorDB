import { useEffect, useState } from "react";
import { Modal } from "./Modal.js";
import { PlusIcon, TrashIcon } from "./Icons.js";
import { Button } from "./ui/Button.js";
import { Hint, ErrorText } from "./ui/Alert.js";
import { List, ListMain, ListRow, EmptyState } from "./ui/List.js";
import { INPUT_CLASS } from "./ui/inputStyles.js";
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
      <Hint>
        A project with no team assigned is visible to everyone. Assigning a team restricts it to that team's members
        (plus the creator and admins).
      </Hint>
      <div className="mb-7 flex max-w-[420px] gap-2">
        <select className={INPUT_CLASS} value={pickTeamId} onChange={(e) => setPickTeamId(e.target.value)}>
          <option value="">Assign a team…</option>
          {availableTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className={INPUT_CLASS} value={pickPermission} onChange={(e) => setPickPermission(e.target.value as PermissionLevel)}>
          {PERMISSION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={assign} disabled={!pickTeamId}>
          <PlusIcon size={14} /> Assign
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {grants.length === 0 ? (
        <EmptyState>No teams assigned — visible to everyone.</EmptyState>
      ) : (
        <List>
          {grants.map((g) => (
            <ListRow key={g.teamId}>
              <ListMain>
                <span>{g.teamName}</span>
              </ListMain>
              <select
                className={INPUT_CLASS}
                value={g.permission}
                onChange={(e) => setPermission(g.teamId, e.target.value as PermissionLevel)}
              >
                {PERMISSION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="icon" data-tooltip="Unassign" onClick={() => unassign(g.teamId)}>
                <TrashIcon size={13} />
              </Button>
            </ListRow>
          ))}
        </List>
      )}
    </Modal>
  );
}

export { ProjectTeamsModal };
export default ProjectTeamsModal;
