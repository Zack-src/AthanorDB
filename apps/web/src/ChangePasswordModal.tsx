import { useState } from "react";
import { Modal } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { Field } from "./ui/Field.js";
import { ErrorText, Hint } from "./ui/Alert.js";

/** Self-service password change — requires the current password, unlike the admin reset in AdminConsole. */
function ChangePasswordModal(props: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
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
    <Modal title="Change password" onClose={props.onClose}>
      {done ? (
        <Hint>Password changed.</Hint>
      ) : (
        <>
          <Field
            label="Current password"
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Field
            label="New password"
            type="password"
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
          <Button variant="primary" onClick={submit} disabled={busy || !currentPassword || !newPassword || !confirm}>
            {busy ? "Changing…" : "Change password"}
          </Button>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}
    </Modal>
  );
}

export { ChangePasswordModal };
export default ChangePasswordModal;
