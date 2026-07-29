import { useState } from "react";
import { LogoMarkIcon } from "./Icons.js";
import type { Session } from "./types.js";

function AcceptInvite(props: { token: string; onLoggedIn: (session: Session) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${props.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        props.onLoggedIn(data as Session);
      } else {
        setError(data.error ?? `Could not accept this invitation (${res.status})`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <span className="brand-mark" style={{ margin: "0 auto 12px" }}>
          <LogoMarkIcon size={16} style={{ color: "white" }} />
        </span>
        <h1 className="auth-title">Set your password</h1>
        <p className="auth-sub">Finish creating your account to accept this invitation.</p>
        <label className="auth-field">
          Password
          <input
            className="input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="auth-field">
          Confirm password
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !password || !confirm}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        {error && <div className="modal-error">{error}</div>}
      </form>
    </div>
  );
}

export { AcceptInvite };
export default AcceptInvite;
