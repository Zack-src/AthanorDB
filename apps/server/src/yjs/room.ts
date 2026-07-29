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
  canWrite: boolean;
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
  private destroyed = false;

  constructor(
    private readonly projectId: string,
    private readonly onEmpty: () => void,
  ) {
    const snapshot = loadSnapshot(projectId);
    if (snapshot) Y.applyUpdate(this.doc, snapshot);

    this.awareness = new awarenessProtocol.Awareness(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      // A project deleted out from under a still-open room (e.g. someone has
      // it open in another tab while it's deleted from the list) must not
      // resurrect rows for an id that no longer exists in `projects` —
      // `destroy()` flips this before closing every connection.
      if (this.destroyed) return;
      // Two kinds of origin reach here: a WebSocket (a live, connected edit —
      // resolve through `conns`) or a plain string (a REST-triggered write
      // like import/restore, which has no connection — the route already
      // resolved the acting username and passed it straight through as the
      // transaction's origin).
      const author = typeof origin === "string" ? origin : (this.conns.get(origin as WebSocket)?.author ?? "system");
      // A DB write failing here (constraint violation, disk full, whatever)
      // must not crash the process — this runs inside a Yjs event handler,
      // so an uncaught throw takes down every other project's connections
      // along with this one. Log and keep going: the in-memory doc (and the
      // broadcast below) stay correct even if this particular write didn't
      // land.
      try {
        appendRevision(this.projectId, author, update);
      } catch (err) {
        console.error(`[room ${this.projectId}] failed to append revision:`, err);
      }
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

  join(conn: WebSocket, author: string, canWrite: boolean): void {
    this.conns.set(conn, { author, awarenessClientIds: new Set(), canWrite });

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
      // A view-only connection must not be able to mutate the doc via a
      // hand-crafted WS frame that bypasses this app's own client entirely —
      // that has to be enforced here, not just hidden in the UI. Unlike
      // `syncProtocol.readSyncMessage` (which dispatches generically and
      // would apply an update regardless of permission), decode the inner
      // sync sub-message type ourselves first so syncStep2/update can be
      // dropped for a read-only connection while syncStep1 (a state-vector
      // request — read-only by construction, just produces a reply) stays
      // allowed either way.
      const canWrite = this.conns.get(conn)?.canWrite ?? false;
      const innerType = decoding.readVarUint(decoder);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      if (innerType === syncProtocol.messageYjsSyncStep1) {
        syncProtocol.readSyncStep1(decoder, encoder, this.doc);
        if (encoding.length(encoder) > 1) conn.send(encoding.toUint8Array(encoder));
      } else if (canWrite) {
        if (innerType === syncProtocol.messageYjsSyncStep2) {
          syncProtocol.readSyncStep2(decoder, this.doc, conn);
        } else if (innerType === syncProtocol.messageYjsUpdate) {
          syncProtocol.readUpdate(decoder, this.doc, conn);
        }
      }
    } else if (messageType === MESSAGE_AWARENESS) {
      // Cursor/presence stays allowed regardless of write access — cosmetic, not a schema mutation.
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
      if (this.snapshotTimer) {
        clearTimeout(this.snapshotTimer);
        this.snapshotTimer = null;
      }
      if (!this.destroyed) {
        try {
          saveSnapshot(this.projectId, this.doc);
        } catch (err) {
          console.error(`[room ${this.projectId}] failed to save snapshot:`, err);
        }
      }
      // Evict once nobody's connected — every project ever opened otherwise
      // keeps a live Y.Doc + Awareness resident in memory for the process's
      // entire lifetime. Safe: `getRoom` recreates it on demand from the
      // snapshot just saved above, same as a fresh server start would.
      this.onEmpty();
    }
  }

  presence(): string[] {
    return Array.from(this.conns.values()).map((meta) => meta.author);
  }

  /**
   * Deleting a project must stop this room from writing anything else back
   * to SQLite (the rows it would write to no longer exist) and disconnect
   * anyone still viewing it. Each socket's own `close` handler still calls
   * `leave()` afterwards — the `destroyed` flag above makes that a no-op
   * instead of resurrecting a snapshot/revision row for the deleted project.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.conns.forEach((_meta, conn) => conn.close());
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
      try {
        saveSnapshot(this.projectId, this.doc);
      } catch (err) {
        console.error(`[room ${this.projectId}] failed to save snapshot:`, err);
      }
    }, SNAPSHOT_DEBOUNCE_MS);
  }
}

const rooms = new Map<string, Room>();

export function getRoom(projectId: string): Room {
  let room = rooms.get(projectId);
  if (!room) {
    room = new Room(projectId, () => rooms.delete(projectId));
    rooms.set(projectId, room);
  }
  return room;
}

/** Tears down a project's in-memory room (if one is live) ahead of deleting its rows — see `Room.destroy`. */
export function closeRoom(projectId: string): void {
  const room = rooms.get(projectId);
  if (!room) return;
  room.destroy();
  rooms.delete(projectId);
}
