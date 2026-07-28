# AthanorDB — TODO

DBML-native, self-hosted, multi-user, versioned, visual editor.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done

---

## Phase 0 — Project scaffolding
- [x] Init git repo
- [x] npm workspaces monorepo (`apps/web`, `apps/server`, `packages/dbml-engine`, `packages/shared`)
- [x] Root README with stack decision
- [ ] `packages/shared`: TS project setup, base tsconfig
- [ ] `packages/dbml-engine`: TS project setup, add `@dbml/core` dep
- [ ] `apps/server`: Fastify + TS scaffold, dev script (tsx watch)
- [ ] `apps/web`: Vite + React + TS scaffold
- [ ] Shared ESLint + Prettier config across workspaces
- [ ] `npm install` at root, verify all workspaces build

## Phase 1 — Core data model (`packages/shared`)
- [ ] Define schema model types: `Project`, `Table`, `Field`, `Ref` (relationship), `Enum`, `Index`, `Note`, `Zone` (colored group), `StickyNote`
- [ ] Visual metadata types: position `{x,y}`, size, color, collapsed/detail-level, edge routing points/style
- [ ] Define "Detail Level" enum: `Compact` (name only) / `Standard` (name + PK/FK) / `Full` (all columns + types + constraints)
- [ ] Define protocol messages for client<->server sync (join project, patch, cursor/presence, history request)
- [ ] Versioned document envelope (project id, revision, timestamp, author)

## Phase 2 — DBML engine (`packages/dbml-engine`)
- [ ] Wrap `@dbml/core`: DBML text -> internal schema model
- [ ] Internal schema model -> DBML text (round-trip, preserve visual metadata as DBML comments or sidecar json)
- [ ] SQL import: Postgres / MySQL / SQL Server / SQLite dump -> internal model (via `@dbml/core` importers)
- [ ] SQL export: internal model -> DDL per dialect (via `@dbml/core` exporters)
- [ ] Diff tool: compare two schema versions (for history viewer / merge conflicts)
- [ ] Validation: circular refs, missing FK targets, duplicate table/field names
- [ ] Unit tests: fixtures for DBML<->SQL round trips per dialect

## Phase 3 — Server (`apps/server`)
- [ ] SQLite schema: projects, revisions (append-only log), snapshots, users, sessions
- [ ] REST: CRUD projects, list revisions, get/restore snapshot, import SQL, export SQL/DBML
- [ ] WebSocket endpoint: Yjs doc sync (`y-websocket` provider) per project room
- [ ] Yjs doc <-> SQLite persistence (periodic snapshot + append-only update log, `y-leveldb`-style pattern but for sqlite)
- [ ] Presence: broadcast connected users, cursor position, selected table
- [ ] History service: reconstruct any past revision from update log; label/pin named checkpoints
- [ ] Local auth: simple username (no external identity provider), session cookie; multi-user = multiple local/LAN clients
- [ ] Static file serving of built `apps/web` for single-process local deployment

## Phase 4 — Web editor shell (`apps/web`)
- [ ] App shell: project list / open / create / import
- [ ] Yjs client provider wired to server WS, connect Yjs doc to canvas state
- [ ] DBML source panel (Monaco editor) — live two-way sync with canvas
- [ ] SQL import dialog (paste or upload .sql, choose dialect)
- [ ] SQL export dialog (choose dialect, copy/download)
- [ ] Toolbar: zoom, fit-to-screen, detail level toggle, undo/redo

## Phase 5 — Visual canvas (React Flow)
- [ ] Custom Table node component, 3 render variants per Detail Level
- [ ] Custom Edge component for refs (1-1, 1-n, n-n), styling per relation type
- [ ] Draggable/resizable Zone node (colored bounding area/group, label)
- [ ] Sticky note node (free text, color, resizable)
- [ ] Per-table color customization (header color, border)
- [ ] Manual edge routing: draggable waypoints, persisted per edge
- [ ] Minimap + zoom controls
- [ ] Auto-layout command (initial placement for imported schemas, dagre or elk)
- [ ] Multi-select, group move, alignment guides
- [ ] Keyboard shortcuts (delete, duplicate, undo/redo, zoom)

## Phase 6 — Multi-user editing
- [ ] Live cursors / selection highlights per connected user (color-coded)
- [ ] Presence list UI (avatars/names of connected users)
- [ ] Conflict-free concurrent edits via Yjs (tables, fields, positions, notes all as Yjs shared types)
- [ ] Awareness cleanup on disconnect
- [ ] Optional: comment threads on tables/fields

## Phase 7 — History
- [ ] History timeline UI: list of revisions/snapshots with author + timestamp
- [ ] Diff view between two revisions (schema-level: added/removed/changed tables/fields/refs)
- [ ] Restore/rollback to a revision (creates new revision, non-destructive)
- [ ] Named checkpoints ("v1.0", "before migration X")
- [ ] Export revision as DBML/SQL snapshot

## Phase 8 — Personalization / visual polish
- [ ] Theme: light/dark
- [ ] Per-project color palette presets
- [ ] Table header color picker, zone color picker, sticky note color picker
- [ ] Font/size options for canvas text (accessibility)
- [ ] Save/restore canvas viewport per user

## Phase 9 — Import/Export completeness
- [ ] Import: raw SQL DDL (multi-dialect), existing DBML file, (stretch) reverse-engineer from live DB connection (introspection)
- [ ] Export: DBML file, SQL DDL per dialect, PNG/SVG snapshot of canvas, PDF
- [ ] Round-trip fidelity tests (import SQL -> edit -> export SQL -> diff)

## Phase 10 — Packaging & deployment
- [ ] Single-command local run (`npm run dev`) — spins up server + web
- [ ] Production build: server serves built web app, single process, single port
- [ ] Dockerfile + docker-compose (optional, for LAN multi-user hosting)
- [ ] Data location config (SQLite file path via env var)
- [ ] Basic backup/export-all script (dump all projects to DBML files)

## Phase 11 — Testing & docs
- [ ] Unit tests: dbml-engine, shared model
- [ ] Integration tests: server REST + WS flows
- [ ] E2E test: create project, edit schema, reload, verify persistence (Playwright)
- [ ] User docs: getting started, DBML cheatsheet, keyboard shortcuts
- [ ] Contributing guide

---

## Open decisions (revisit as needed)
- Auth model for multi-user on LAN: none / simple username / basic password — currently planned as simple local username, no external IdP.
- Canvas library: React Flow chosen over building custom SVG/canvas engine, for speed; revisit if performance issues with very large schemas (500+ tables).
- History storage: Yjs update log + periodic SQLite snapshots, avoids storing full doc on every change.
