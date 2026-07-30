import { useState } from "react";
import { Modal } from "../Modal.js";
import { Button } from "../ui/Button.js";
import { Field } from "../ui/Field.js";
import { ErrorText, Hint } from "../ui/Alert.js";
import type { UserSummary } from "../types.js";

export function ResetPasswordModal(props: { targetUser: UserSummary; onClose: () => void }) {
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
        <Hint>
          Password reset — {props.targetUser.email} has been signed out everywhere and needs the new password to log
          back in.
        </Hint>
      ) : (
        <>
          <Field
            label="New password"
            type="password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Field
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <Button variant="primary" onClick={submit} disabled={busy || !newPassword || !confirm}>
            {busy ? "Resetting…" : "Reset password"}
          </Button>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}
    </Modal>
  );
}
