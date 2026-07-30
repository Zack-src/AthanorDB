import { useEffect, useState } from "react";
import type { Session } from "../types.js";

export interface AuthSessionHandle {
  session: Session | null | "loading";
  setSession: (session: Session | null) => void;
  serverStatus: "checking" | "ok" | "down";
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

/** Bootstraps the logged-in session and server health once at mount, and exposes the auth actions that mutate it. */
export function useAuthSession(onLogout: () => void): AuthSessionHandle {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [serverStatus, setServerStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? setServerStatus("ok") : setServerStatus("down")))
      .catch(() => setServerStatus("down"));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<Session>) : null))
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    onLogout();
  };

  const updateDisplayName = async (name: string) => {
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    if (res.ok) setSession(await res.json());
  };

  return { session, setSession, serverStatus, logout, updateDisplayName };
}
