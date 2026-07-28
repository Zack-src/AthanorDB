import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync.js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as encoding from "lib0/encoding.js";
import * as decoding from "lib0/decoding.js";
import type { WebSocket } from "ws";
import { appendRevision, saveSnapshot, loadSnapshot } from "./persistence.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SNAPSHOT_DEBOUNCE_MS = 2000;

interface ConnMeta {
  author: string;
  awarenessClientIds: Set<number>;
}

/**
 * One project's live collaborative document: a Y.Doc shared over WS by all
 * connected clients, an Awareness instance for presence/cursors, and
 * SQLite-backed persistence (append-only revision log + debounced snapshot).
 */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness: awarenessProtocol.Awareness;
  private readonly conns = new Map<WebSocket, ConnMeta>();
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(private readonly projectId: string) {
    const snapshot = loadSnapshot(projectId);
    if (snapshot) Y.applyUpdate(this.doc, snapshot);

    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const author = this.conns.get(origin as WebSocket)?.author ?? "system";
      appendRevision(this.projectId, author, update);
      this.scheduleSnapshot();

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin as WebSocket | undefined);
    });

    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        const meta = this.conns.get(origin as WebSocket);
        if (meta) {
          added.forEach((id) => meta.awarenessClientIds.add(id));
          removed.forEach((id) => meta.awarenessClientIds.delete(id));
        }

        const changed = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
        this.broadcast(encoding.toUint8Array(encoder), origin as WebSocket | undefined);
      },
    );
  }

  join(conn: WebSocket, author: string): void {
    this.conns.set(conn, { author, awarenessClientIds: new Set() });

    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    conn.send(encoding.toUint8Array(syncEncoder));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(states.keys())),
      );
      conn.send(encoding.toUint8Array(awarenessEncoder));
    }
  }

  receive(conn: WebSocket, data: Uint8Array): void {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, conn);
      if (encoding.length(encoder) > 1) conn.send(encoding.toUint8Array(encoder));
    } else if (messageType === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), conn);
    }
  }

  leave(conn: WebSocket): void {
    const meta = this.conns.get(conn);
    this.conns.delete(conn);
    if (meta && meta.awarenessClientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(meta.awarenessClientIds), null);
    }
    if (this.conns.size === 0) {
      saveSnapshot(this.projectId, this.doc);
    }
  }

  presence(): string[] {
    return Array.from(this.conns.values()).map((meta) => meta.author);
  }

  private broadcast(message: Uint8Array, exclude?: WebSocket): void {
    this.conns.forEach((_meta, conn) => {
      if (conn !== exclude && conn.readyState === conn.OPEN) conn.send(message);
    });
  }

  private scheduleSnapshot(): void {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      saveSnapshot(this.projectId, this.doc);
    }, SNAPSHOT_DEBOUNCE_MS);
  }
}

const rooms = new Map<string, Room>();

export function getRoom(projectId: string): Room {
  let room = rooms.get(projectId);
  if (!room) {
    room = new Room(projectId);
    rooms.set(projectId, room);
  }
  return room;
}
