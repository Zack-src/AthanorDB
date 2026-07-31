# AthanorDB

Local-first, self-hosted, DBML-native database schema diagramming — think dbdiagram.io, but running entirely on your own machine or LAN, with real-time multi-user editing and full history built in.

## Features

- **DBML-native**: the schema's source of truth is DBML text. A live Monaco editor panel sits next to the canvas and syncs both ways — edit the diagram visually, or edit the DBML directly, changes apply to the other side automatically (~600ms debounce).
- **Visual canvas editor** (React Flow): drag tables/zones/sticky notes around, resize zones and notes, pan/zoom, minimap. No "Add Table" toolbar button — right-click empty canvas to add a table, zone, or sticky note.
- **Detail levels per table**: `compact` (key fields only), `standard` (PK/FK), `full` (every field) — switch one table or all of them at once.
- **Auto-layout**: one-click layout of the whole diagram (dagre), following FK direction.
- **Styling**: color picker (preset swatches + custom hex) for table headers, zones, and sticky notes.
- **Comments**: attach threaded comments to a table or a specific field.
- **Real-time collaboration**: multiple people can open the same project at once (Yjs CRDT sync over WebSocket) — live cursors, colored presence list, no lock-step required.
- **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z) and **duplicate** (Ctrl+D) for canvas edits.
- **Manual reference routing**: double-click a ref line to add a waypoint and route it around tables; lines animate in the direction of cardinality (both directions for many-to-many).
- **Import**: DBML or raw SQL DDL (Postgres/MySQL/MSSQL), via paste or file upload. Re-importing merges by name, so existing positions/styling/detail levels are preserved rather than reset.
- **Export**: DBML, SQL (Postgres/MySQL/MSSQL), or a canvas snapshot as PNG/SVG/PDF.
- **Validation panel**: flags circular references, missing FK targets, and duplicate table/field names (informational — never blocks editing).
- **History**: every change is a revision. Browse the timeline, label checkpoints (e.g. `v1.0`), preview a past revision's DBML, see a schema-level diff against the current state, and restore non-destructively (restoring creates a new revision, it never rewrites history).
- **Per-user preferences**: canvas text size and last pan/zoom position are remembered per person, not shared.
- **Backup script**: dump every project to a `.dbml` file on disk (`npm run backup`).
- **Dark theme**, single unified header, no cloud dependency — everything (fonts, editor, icons) is bundled, nothing loads from a CDN.

## Stack

| Layer               | Choice                                    | Why                                                                                    |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Monorepo            | npm workspaces                             | no extra global tool                                                                    |
| Frontend            | React + TypeScript + Vite                  | fast dev loop, huge ecosystem                                                          |
| Canvas              | React Flow (`@xyflow/react`)               | node/edge graph primitive, zoom/pan/minimap, custom node renderers per detail level    |
| DBML editor         | Monaco (`@monaco-editor/react`), self-hosted | same editor as VS Code; self-hosted worker/assets, no CDN                            |
| Auto-layout         | `@dagrejs/dagre`                           | directed-graph layout, used to lay tables out by FK direction                          |
| Canvas export       | `html-to-image` + `jsPDF`                  | PNG/SVG snapshot of the canvas, wrapped into a PDF                                     |
| Backend             | Node + TypeScript + Fastify                | lightweight server, native WS plugin                                                   |
| Realtime collab     | Yjs CRDT, hand-rolled WS protocol (`y-protocols` + `lib0`) | multi-user editing and undo/history almost for free, no `y-websocket` dependency |
| Persistence         | SQLite (`better-sqlite3`)                  | zero-config, single file, fits "local first"                                          |
| DBML parse/gen      | `@dbml/core`                                | official parser, handles DBML <-> SQL (Postgres/MySQL/MSSQL) both ways                |
| Diagram state model | custom schema layered on the Yjs doc       | tables/fields/refs/notes/zones + visual metadata (position, color, detail level)      |
| Packaging           | plain Node process, optional Docker        | `npm run dev` or `docker compose up`, no cloud dependency                              |

## Running

Requires Node 20-23 (`.nvmrc`/`.node-version` pin 22). **Node 24 is not supported yet**: the server's SQLite driver (`better-sqlite3`) is a native addon and has no precompiled binary for Node 24 on any platform as of this writing, so `npm install` will fail to produce a working build unless you have C++ build tools (Visual Studio Build Tools + Python) installed to compile it from source. If you're on a locked-down corporate machine without those, install Node 22 instead — no admin rights needed:

1. Download the "Windows Binary (.zip)" for Node 22 LTS from [nodejs.org](https://nodejs.org/en/download).
2. Unzip it anywhere in your user profile (e.g. `C:\Users\<you>\node22`).
3. Point your shell at it for this project, e.g. in PowerShell: `$env:PATH = "C:\Users\<you>\node22;$env:PATH"` (do this once per terminal session, or add it to your PowerShell profile).
4. Confirm with `node -v` (should print `v22.x`), then proceed below as normal.

```bash
npm install
npm run dev          # server (:3001) + web (:5173) together, with hot reload
```

Production (single process, single port — the server serves the built web app itself):

```bash
npm run build
npm start             # http://localhost:3001
```

### Configuration

Every value is validated at startup — a malformed one exits immediately with a `[config]` message rather than silently falling back.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ATHANORDB_DB_PATH` | `./data/athanordb.sqlite` | SQLite file. Its directory is created if missing. |
| `PORT` | `3001` | HTTP/WS port. |
| `ATHANORDB_COOKIE_SECURE` | unset (= `false`) | Marks the session cookie `Secure`. **Set to `true` when running behind TLS** — with `NODE_ENV=production` and this unset, the server warns loudly at boot. |
| `ATHANORDB_ALLOWED_ORIGINS` | unset | Comma-separated extra origins allowed to make state-changing requests. The app's own host is always allowed; this is only needed if the UI is served from a different origin than the API. |
| `ATHANORDB_MAX_BODY_MB` | `4` | Max REST request body (DBML/SQL imports are the large ones). |
| `ATHANORDB_MAX_WS_FRAME_MB` | `8` | Max size of a single WebSocket frame (one Yjs update). |

`SIGTERM`/`SIGINT` shut down gracefully: connections stop, every live document is snapshotted to SQLite, then the database is closed — so `docker stop` doesn't drop the last few seconds of edits.

### Docker

```bash
docker compose up --build
```

Serves on `:3001`, with project data persisted in a named volume (`athanordb-data`) rather than the container's own filesystem.

### Backup

Dump every project to a `.dbml` file (defaults to `./backups/<timestamp>/`):

```bash
npm run backup [-- <outputDir>]
```

### First admin account

Every account besides the first is created by accepting an admin-issued invitation, so bootstrap the first global admin directly:

```bash
npm run bootstrap-admin -- <email> <password>
```

Password must be 8–128 characters. Respects `ATHANORDB_DB_PATH` same as the server. Fails if that email already exists — run once, then invite everyone else from the admin console.

### Accounts, teams and invitations

- **Login** is email + password, with a server-side session cookie (`httpOnly`, `SameSite=Lax`, 30-day rolling expiry). Passwords are scrypt-hashed; login is rate limited to 10 attempts/minute per IP.
- **Invitations** are the only way to create further accounts: an admin issues one from the admin console and gets back an `/invite/<token>` URL, valid 7 days. **There is no email delivery** — the admin relays that link themselves, so treat it as a live credential and send it over a channel you trust.
- **Teams** scope project visibility. A project with no team assigned is visible to everyone; assigning a team restricts it to that team's members plus the creator and admins, at `view` / `edit` / `administrator` level.
- **Admins** manage users, teams and invitations, and can reset any password (which also kills that user's sessions).

## Repo layout

```
apps/
  web/      React app (canvas editor, DBML/SQL panels)
  server/   Fastify + WS server, SQLite storage, Yjs doc host
packages/
  dbml-engine/  DBML <-> SQL <-> internal-model conversion, diff, validation
  shared/       shared TS types (schema model, DTOs, protocol messages), Yjs doc <-> Project binding
docs/
  todo.md       full project plan and progress log
```

## Status

Actively developed. See `docs/todo.md` for the full plan, current progress, and known limitations.
