import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync.js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as encoding from "lib0/encoding.js";
import * as decoding from "lib0/decoding.js";
import { hashColor } from "./awarenessColor.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export interface CursorPosition {
  x: number;
  y: number;
}

export interface AwarenessState {
  user: { name: string; color: string };
  cursor: CursorPosition | null;
}

export interface ProjectConnection {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  disconnect(): void;
}

/**
 * Client-side half of the raw sync/awareness protocol implemented by the
 * server's `Room` (apps/server/src/yjs/room.ts) — mirrors its message
 * framing since we hand-roll the WS transport instead of using `y-websocket`.
 */
export function connectProject(projectId: string, user: string): ProjectConnection {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws/${projectId}?user=${encodeURIComponent(user)}`;
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.addEventListener("open", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    socket.send(encoding.toUint8Array(encoder));

    // Set local state only once the socket is open: the awareness "update"
    // listener below drops updates while `readyState !== OPEN`, so setting
    // it any earlier would silently never reach the server.
    const initialState: AwarenessState = { user: { name: user, color: hashColor(user) }, cursor: null };
    awareness.setLocalState(initialState);
  });

  socket.addEventListener("message", (event) => {
    const decoder = decoding.createDecoder(new Uint8Array(event.data as ArrayBuffer));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, socket);
      if (encoding.length(encoder) > 1) socket.send(encoding.toUint8Array(encoder));
    } else if (messageType === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), socket);
    }
  });

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === socket || socket.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    socket.send(encoding.toUint8Array(encoder));
  });

  awareness.on(
    "update",
    ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === socket || socket.readyState !== WebSocket.OPEN) return;
      const changed = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      socket.send(encoding.toUint8Array(encoder));
    },
  );

  return {
    doc,
    awareness,
    disconnect() {
      awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], "disconnect");
      socket.close();
    },
  };
}
