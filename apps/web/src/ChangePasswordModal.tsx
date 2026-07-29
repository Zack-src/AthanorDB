import { useState } from "react";
import { Modal } from "./Modal.js";

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
        <p className="modal-hint">Password changed.</p>
      ) : (
        <>
          <label className="auth-field">
            Current password
            <input
              className="input"
              type="password"
              autoFocus
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="auth-field">
            New password
            <input
              className="input"
              type="password"
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
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !currentPassword || !newPassword || !confirm}
          >
            {busy ? "Changing…" : "Change password"}
          </button>
          {error && <div className="modal-error">{error}</div>}
        </>
      )}
    </Modal>
  );
}

export { ChangePasswordModal };
export default ChangePasswordModal;
