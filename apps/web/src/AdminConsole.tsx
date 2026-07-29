import { useEffect, useState } from "react";
import { Modal } from "./Modal.js";
import { ChevronLeftIcon, KeyIcon, LinkIcon, LogoMarkIcon, PlusIcon, TrashIcon, UsersIcon } from "./Icons.js";
import type { InvitationSummary, TeamDetail, TeamSummary, UserSummary } from "./types.js";

const SECTIONS = [
  { key: "invitations", label: "Invitations" },
  { key: "teams", label: "Teams" },
  { key: "users", label: "Users" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

function InvitationsTab() {
  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/invitations")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`list failed (${r.status})`))))
      .then(setInvitations)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(refresh, []);

  const create = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, isAdmin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmail("");
        setIsAdmin(false);
        refresh();
      } else {
        setError(data.error ?? `Invite failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: string) => {
    await fetch(`/api/invitations/${token}`, { method: "DELETE" });
    refresh();
  };

  const copyLink = (inv: InvitationSummary) => {
    navigator.clipboard.writeText(`${location.origin}/invite/${inv.token}`).then(() => {
      setCopiedToken(inv.token);
      setTimeout(() => setCopiedToken((t) => (t === inv.token ? null : t)), 1500);
    });
  };

  return (
    <div>
      <div className="project-create-row">
        <input
          className="input"
          placeholder="Email to invite"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <label className="admin-checkbox-field">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          Admin
        </label>
        <button className="btn btn-primary" onClick={create} disabled={busy || !email.trim()}>
          <PlusIcon size={14} /> Invite
        </button>
      </div>
      {error && <div className="modal-error">{error}</div>}
      {invitations.length === 0 ? (
        <div className="empty-state">No invitations yet.</div>
      ) : (
        <div className="admin-list">
          {invitations.map((inv) => (
            <div key={inv.token} className="admin-list-row">
              <div className="admin-list-main">
                <span>{inv.email}</span>
                {inv.isAdmin && <span className="badge-admin">Admin</span>}
              </div>
              <span className={`badge-status badge-status-${inv.status}`}>{inv.status}</span>
              {inv.status === "pending" && (
                <>
                  <button className="btn btn-sm" onClick={() => copyLink(inv)}>
                    <LinkIcon size={12} /> {copiedToken === inv.token ? "Copied" : "Copy link"}
                  </button>
                  <button className="btn btn-icon btn-ghost" title="Revoke" onClick={() => revoke(inv.token)}>
                    <TrashIcon size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResetPasswordModal(props: { targetUser: UserSummary; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${props.targetUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reset password — ${props.targetUser.email}`} onClose={props.onClose}>
      {done ? (
        <p className="modal-hint">
          Password reset — {props.targetUser.email} has been signed out everywhere and needs the new password to log
          back in.
        </p>
      ) : (
        <>
          <label className="auth-field">
            New password
            <input
              className="input"
              type="password"
              autoFocus
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="auth-field">
            Confirm new password
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !newPassword || !confirm}>
            {busy ? "Resetting…" : "Reset password"}
          </button>
          {error && <div className="modal-error">{error}</div>}
        </>
      )}
    </Modal>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`list failed (${r.status})`))))
      .then(setUsers)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      {error && <div className="modal-error">{error}</div>}
      {users.length === 0 ? (
        <div className="empty-state">No users yet.</div>
      ) : (
        <div className="admin-list">
          {users.map((u) => (
            <div key={u.id} className="admin-list-row">
              <div className="admin-list-main">
                <span>{u.displayName}</span>
                <span style={{ color: "var(--color-text-muted)" }}>{u.email}</span>
                {u.isAdmin && <span className="badge-admin">Admin</span>}
              </div>
              <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{u.createdAt}</span>
              <button className="btn btn-icon btn-ghost" title="Reset password" onClick={() => setResetTarget(u)}>
                <KeyIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {resetTarget && <ResetPasswordModal targetUser={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}

function TeamDetailView(props: { teamId: string; onClose: () => void; onChanged: () => void }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [pickUserId, setPickUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    fetch(`/api/teams/${props.teamId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`load failed (${r.status})`))))
      .then(setTeam)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(refresh, [props.teamId]);
  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {});
  }, []);

  const addMember = async () => {
    if (!pickUserId) return;
    await fetch(`/api/teams/${props.teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: pickUserId }),
    });
    setPickUserId("");
    refresh();
    props.onChanged();
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/teams/${props.teamId}/members/${userId}`, { method: "DELETE" });
    refresh();
    props.onChanged();
  };

  const availableUsers = users.filter((u) => !team?.members.some((m) => m.id === u.id));

  return (
    <Modal title={team ? `Team: ${team.name}` : "Team"} onClose={props.onClose}>
      {error && <div className="modal-error">{error}</div>}
      {team && (
        <>
          <div className="project-create-row">
            <select className="select" value={pickUserId} onChange={(e) => setPickUserId(e.target.value)}>
              <option value="">Add a member…</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addMember} disabled={!pickUserId}>
              <PlusIcon size={14} /> Add
            </button>
          </div>
          {team.members.length === 0 ? (
            <div className="empty-state">No members yet.</div>
          ) : (
            <div className="admin-list">
              {team.members.map((m) => (
                <div key={m.id} className="admin-list-row">
                  <div className="admin-list-main">
                    <span>{m.displayName}</span>
                    <span style={{ color: "var(--color-text-muted)" }}>{m.email}</span>
                  </div>
                  <button className="btn btn-icon btn-ghost" title="Remove from team" onClick={() => removeMember(m.id)}>
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`list failed (${r.status})`))))
      .then(setTeams)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(refresh, []);

  const create = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setNewName("");
        refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Create failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div>
      <div className="project-create-row">
        <input
          className="input"
          placeholder="New team name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="btn btn-primary" onClick={create} disabled={busy || !newName.trim()}>
          <PlusIcon size={14} /> Create team
        </button>
      </div>
      {error && <div className="modal-error">{error}</div>}
      {teams.length === 0 ? (
        <div className="empty-state">No teams yet.</div>
      ) : (
        <div className="admin-list">
          {teams.map((t) => (
            <div key={t.id} className="admin-list-row">
              <button className="admin-list-main admin-list-main-button" onClick={() => setSelectedTeamId(t.id)}>
                <UsersIcon size={13} style={{ color: "var(--color-text-muted)" }} />
                <span>{t.name}</span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                </span>
              </button>
              <button className="btn btn-icon btn-ghost" title="Delete team" onClick={() => remove(t.id)}>
                <TrashIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {selectedTeamId && (
        <TeamDetailView teamId={selectedTeamId} onClose={() => setSelectedTeamId(null)} onChanged={refresh} />
      )}
    </div>
  );
}

function AdminConsole(props: { onClose: () => void }) {
  const [section, setSection] = useState<Section>("invitations");

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="btn btn-icon btn-ghost" onClick={props.onClose} title="Back to projects">
          <ChevronLeftIcon size={16} />
        </button>
        <span className="brand-mark" style={{ width: 24, height: 24 }}>
          <LogoMarkIcon size={13} style={{ color: "white" }} />
        </span>
        <span className="toolbar-project-name">Admin console</span>
      </header>
      <div className="project-list-page">
        <div className="project-list-inner">
          <div className="project-tabs">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`project-tab${section === s.key ? " project-tab-active" : ""}`}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {section === "invitations" && <InvitationsTab />}
          {section === "teams" && <TeamsTab />}
          {section === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

export { AdminConsole };
export default AdminConsole;
