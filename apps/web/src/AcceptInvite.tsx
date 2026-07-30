import { useState } from "react";
import { LogoMarkIcon } from "./Icons.js";
import { Button } from "./ui/Button.js";
import { Field } from "./ui/Field.js";
import { ErrorText } from "./ui/Alert.js";
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
    <div className="flex h-full items-center justify-center p-6">
      <form
        className="flex w-full max-w-[340px] flex-col rounded-md border border-border bg-surface p-7 shadow-md"
        onSubmit={submit}
      >
        <span className="mx-auto mb-3 flex h-[26px] w-[26px] items-center justify-center rounded-sm bg-gradient-to-br from-primary to-[#7c3aed] text-white">
          <LogoMarkIcon size={16} style={{ color: "white" }} />
        </span>
        <h1 className="mb-1 text-center text-lg font-bold">Set your password</h1>
        <p className="mb-5 text-center text-[13px] text-text-muted">Finish creating your account to accept this invitation.</p>
        <Field
          label="Password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Field
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <Button variant="primary" type="submit" disabled={busy || !password || !confirm}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </div>
  );
}

export { AcceptInvite };
export default AcceptInvite;
