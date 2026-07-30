import { useState } from "react";
import { LogoMarkIcon } from "./Icons.js";
import { Button } from "./ui/Button.js";
import { Field } from "./ui/Field.js";
import { ErrorText } from "./ui/Alert.js";
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
    <div className="flex h-full items-center justify-center p-6">
      <form
        className="flex w-full max-w-[340px] flex-col rounded-md border border-border bg-surface p-7 shadow-md"
        onSubmit={submit}
      >
        <span className="mx-auto mb-3 flex h-[26px] w-[26px] items-center justify-center rounded-sm bg-gradient-to-br from-primary to-[#7c3aed] text-white">
          <LogoMarkIcon size={16} style={{ color: "white" }} />
        </span>
        <h1 className="mb-1 text-center text-lg font-bold">AthanorDB</h1>
        <p className="mb-5 text-center text-[13px] text-text-muted">
          Sign in to continue — new accounts are invitation-only.
        </p>
        <Field label="Email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <Button variant="primary" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </div>
  );
}

export { Login };
export default Login;
