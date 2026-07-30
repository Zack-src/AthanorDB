import { useEffect, useState } from "react";
import { KeyIcon } from "../Icons.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";
import { ErrorText } from "../ui/Alert.js";
import { List, ListMain, ListRow, EmptyState } from "../ui/List.js";
import type { UserSummary } from "../types.js";
import { ResetPasswordModal } from "./ResetPasswordModal.js";

export function UsersTab() {
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
      {error && <ErrorText>{error}</ErrorText>}
      {users.length === 0 ? (
        <EmptyState>No users yet.</EmptyState>
      ) : (
        <List>
          {users.map((u) => (
            <ListRow key={u.id}>
              <ListMain>
                <span>{u.displayName}</span>
                <span className="text-text-muted">{u.email}</span>
                {u.isAdmin && <Badge tone="admin">Admin</Badge>}
              </ListMain>
              <span className="text-xs text-text-muted">{u.createdAt}</span>
              <Button variant="ghost" size="icon" data-tooltip="Reset password" onClick={() => setResetTarget(u)}>
                <KeyIcon size={13} />
              </Button>
            </ListRow>
          ))}
        </List>
      )}
      {resetTarget && <ResetPasswordModal targetUser={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}
