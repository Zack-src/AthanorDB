# AthanorDB

Local-first. Self-hosted, DBML-native, multi-user, versioned.

## Stack

| Layer               | Choice                              | Why                                                                                           |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Monorepo            | npm workspaces                      | no extra global tool, node 24 native                                                          |
| Frontend            | React + TypeScript + Vite           | fast dev loop, huge ecosystem                                                                 |
| Canvas              | React Flow (`@xyflow/react`)        | node/edge graph primitive, built-in zoom/pan/minimap, custom node renderers for detail levels |
| Backend             | Node + TypeScript + Fastify         | lightweight local server, WS support                                                          |
| Realtime collab     | Yjs + y-websocket                   | CRDT sync, gives multi-user editing AND undo/history almost for free                          |
| Persistence         | SQLite (better-sqlite3)             | zero-config, single file, fits "local first"                                                  |
| DBML parse/gen      | `@dbml/core`                        | official parser, handles DBML <-> SQL (Postgres/MySQL/MSSQL/etc) both ways                    |
| Diagram state model | custom schema layered on Yjs doc    | tables/fields/refs/notes/zones + visual metadata (position, color, collapsed level)           |
| Packaging           | plain node process, optional Docker | run with `npm run dev`, no cloud dependency                                                   |

## Repo layout

```
apps/
  web/      React app (canvas editor, DBML/SQL panels)
  server/   Fastify + WS server, SQLite storage, Yjs doc host
packages/
  dbml-engine/  DBML <-> SQL <-> internal-model conversion
  shared/       shared TS types (schema model, DTOs, protocol messages)
docs/
  todo.md       full project plan
```

## Running

```bash
npm install
npm run dev          # server (:3001) + web (:5173) together, with hot reload
```

Production (single process, single port — the server serves the built web app itself):

```bash
npm run build
npm start             # http://localhost:3001
```

SQLite data location defaults to `./data/athanordb.sqlite`; override with `ATHANORDB_DB_PATH`. Port defaults to `3001`; override with `PORT`.

### Docker

```bash
docker compose up --build
```

Serves on `:3001`, with project data persisted in a named volume (`athanordb-data`) rather than the container's own filesystem.

## Status

Scaffolding stage. See `docs/todo.md` for the full plan and current progress.
