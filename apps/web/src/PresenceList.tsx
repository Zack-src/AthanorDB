import type { AwarenessState } from "./yjsClient.js";

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

function Avatar(props: { name: string; color: string }) {
  return (
    <span className="presence-avatar" style={{ background: props.color }} data-tooltip={props.name}>
      {initials(props.name)}
    </span>
  );
}

export function PresenceList(props: { localName: string; localColor: string; remote: Map<number, AwarenessState> }) {
  return (
    <div className="presence-stack">
      <Avatar name={`${props.localName} (you)`} color={props.localColor} />
      {Array.from(props.remote.entries()).map(([clientId, state]) => (
        <Avatar key={clientId} name={state.user.name} color={state.user.color} />
      ))}
    </div>
  );
}
