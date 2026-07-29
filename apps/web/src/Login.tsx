import { useState } from "react";
import { LogoMarkIcon } from "./Icons.js";
import type { Session } from "./types.js";

/**
 * Full-page, not a modal — this gates the entire app before any project UI
 * (or even the project list) exists, so there's nothing underneath it to
 * dim behind an overlay.
 */
function Login(props: { onLoggedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        props.onLoggedIn(data as Session);
      } else {
        setError(data.error ?? `Login failed (${res.status})`);
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
        <h1 className="auth-title">AthanorDB</h1>
        <p className="auth-sub">Sign in to continue — new accounts are invitation-only.</p>
        <label className="auth-field">
          Email
          <input
            className="input"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="auth-field">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <div className="modal-error">{error}</div>}
      </form>
    </div>
  );
}

export { Login };
export default Login;
