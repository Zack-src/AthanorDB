import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync.js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as encoding from "lib0/encoding.js";
import * as decoding from "lib0/decoding.js";
import type { WebSocket } from "ws";
import {
  ENUMS_KEY,
  META_KEY,
  REFS_KEY,
  STICKY_NOTES_KEY,
  TABLES_KEY,
  ZONES_KEY,
  clampCollectionValue,
  clampMetaValue,
} from "@athanordb/shared";
import { appendRevision, saveSnapshot, loadSnapshot } from "./persistence.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SNAPSHOT_DEBOUNCE_MS = 2000;

const COLLECTION_KEYS = [META_KEY, TABLES_KEY, REFS_KEY, ENUMS_KEY, ZONES_KEY, STICKY_NOTES_KEY];

/**
 * Transaction origin for the server's own clamping writes. A plain string
 * (never a WebSocket) so the correction broadcasts to *every* client
 * including the one that sent the over-long value — otherwise that client
 * would keep its own longer version and the docs would diverge.
 */
const LIMIT_ORIGIN = "system";

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
  /** Collection key -> entity ids written since the last `enforceLimits()` pass. */
  private readonly pendingChecks = new Map<string, Set<string>>();

  constructor(
    private readonly projectId: string,
    private readonly onEmpty: () => void,
  ) {
    const snapshot = loadSnapshot(projectId);
    if (snapshot) Y.applyUpdate(this.doc, snapshot);

    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Note every entity touched by an incoming update so `enforceLimits()`
    // only has to re-check what actually changed, instead of walking the
    // whole project on every keystroke-sized update.
    for (const collection of COLLECTION_KEYS) {
      this.doc.getMap(collection).observe((event, transaction) => {
        if (transaction.origin === LIMIT_ORIGIN) return;
        let ids = this.pendingChecks.get(collection);
        if (!ids) {
          ids = new Set();
          this.pendingChecks.set(collection, ids);
        }
        event.changes.keys.forEach((change, key) => {
          if (change.action !== "delete") ids.add(key);
        });
      });
    }

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
        // Yjs observers run synchronously during transaction cleanup, so by
        // the time the read above returns, `pendingChecks` holds everything
        // this frame touched.
        this.enforceLimits();
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

  /**
   * Writes this room's current state to SQLite right now, cancelling any
   * pending debounced snapshot. Used on shutdown, where waiting out the
   * debounce would mean losing the last couple of seconds of edits.
   */
  flush(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.destroyed) return;
    try {
      saveSnapshot(this.projectId, this.doc);
    } catch (err) {
      console.error(`[room ${this.projectId}] failed to save snapshot:`, err);
    }
  }

  /**
   * Re-applies the shared per-field length limits to everything the last
   * update touched, truncating anything over its cap.
   *
   * The client's `maxLength` attributes are UX only: a WS frame is raw Yjs
   * ops, so a non-browser client (or a patched one) can put a megabyte in a
   * table name and `receive()` above would happily apply it — the permission
   * check is the only thing that ever looked at these frames. Clamping here,
   * rather than rejecting the frame, keeps the CRDT convergent: the offender's
   * ops stay in the log, and the truncation is just another edit everyone
   * (including the offender) receives.
   */
  private enforceLimits(): void {
    if (this.pendingChecks.size === 0) return;
    const pending = Array.from(this.pendingChecks.entries());
    this.pendingChecks.clear();

    this.doc.transact(() => {
      for (const [collection, ids] of pending) {
        const map = this.doc.getMap(collection);
        for (const id of ids) {
          const current = map.get(id);
          const clamped =
            collection === META_KEY ? clampMetaValue(id, current) : clampCollectionValue(collection, current);
          if (clamped !== null) {
            console.warn(`[room ${this.projectId}] clamped over-length input in ${collection}/${id}`);
            map.set(id, clamped);
          }
        }
      }
    }, LIMIT_ORIGIN);
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

/**
 * Snapshots every live room immediately. Called on SIGTERM/SIGINT: without it,
 * anything edited inside the last `SNAPSHOT_DEBOUNCE_MS` is only in the
 * revision log and the in-memory doc, and dies with the process. Returns how
 * many rooms were flushed.
 */
export function flushAllRooms(): number {
  for (const room of rooms.values()) room.flush();
  return rooms.size;
}

/** Disconnects every client and drops every room — shutdown, after `flushAllRooms`. */
export function closeAllRooms(): void {
  for (const room of rooms.values()) room.destroy();
  rooms.clear();
}

/** Tears down a project's in-memory room (if one is live) ahead of deleting its rows — see `Room.destroy`. */
export function closeRoom(projectId: string): void {
  const room = rooms.get(projectId);
  if (!room) return;
  room.destroy();
  rooms.delete(projectId);
}
