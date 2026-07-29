# AthanorDB — TODO

DBML-native, self-hosted, multi-user, versioned, visual editor.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done

---

## Phase 0 — Project scaffolding

- [x] Init git repo
- [x] npm workspaces monorepo (`apps/web`, `apps/server`, `packages/dbml-engine`, `packages/shared`)
- [x] Root README with stack decision
- [x] `packages/shared`: TS project setup, base tsconfig
- [x] `packages/dbml-engine`: TS project setup, add `@dbml/core` dep
- [x] `apps/server`: Fastify + TS scaffold, dev script (tsx watch)
- [x] `apps/web`: Vite + React + TS scaffold
- [x] Shared ESLint + Prettier config across workspaces — flat `eslint.config.js` (typescript-eslint + react-hooks for `apps/web`), root `.prettierrc.json`; whole repo reformatted once to match
- [x] `npm install` at root, verify all workspaces build

## Phase 1 — Core data model (`packages/shared`)

- [x] Define schema model types: `Project`, `Table`, `Field`, `Ref` (relationship), `Enum`, `Index`, `Note`, `Zone` (colored group), `StickyNote`
- [x] Visual metadata types: position `{x,y}`, size, color, collapsed/detail-level, edge routing points/style
- [x] Define "Detail Level" enum: `Compact` (name only) / `Standard` (name + PK/FK) / `Full` (all columns + types + constraints)
- [x] Define protocol messages for client<->server sync (join project, patch, cursor/presence, history request)
- [ ] Versioned document envelope (project id, revision, timestamp, author) — `RevisionMeta` stub exists, not wired to real revisions yet

## Phase 2 — DBML engine (`packages/dbml-engine`)

- [x] Wrap `@dbml/core`: DBML/SQL text -> raw Database model -> internal `Project` shape (`toProject`, basic mapping; visual metadata defaulted, not preserved yet). Fixed a latent bug where `Ref` endpoints resolved to table/field _names_ instead of the numeric ids tables/fields actually use, silently breaking all ref lookups. Added `mergeProjectIntoExisting(existing, incoming)`: reconciles a freshly-reparsed project into the live one by matching tables/fields by _name_, so reimporting/reapplying DBML keeps existing ids/positions/detail-level instead of resetting the whole layout every time (verified live: moved+resized table survives a reimport that adds a field to it and a whole new table).
- [~] Internal schema model -> DBML text (round-trip): `projectToDbml` done (tables/fields/indexes/enums/refs); visual metadata (position/color/detail level/zones/sticky notes) still has no DBML equivalent and is dropped, not yet preserved as comments/sidecar json
- [~] SQL import: Postgres / MySQL / SQL Server -> internal model (via `@dbml/core`). Note: `@dbml/core` has no SQLite dialect support, dropped from scope unless we add a separate SQLite DDL parser
- [x] SQL export: internal model -> DDL per dialect (postgres/mysql/mssql via `@dbml/core` `ModelExporter`)
- [x] Diff tool: compare two schema versions (for history viewer / merge conflicts) — `diff.ts`: `diffProjects(before, after)`, matched by entity id (right granularity for two revisions of the _same_ doc's history, where ids are stable — unlike an unrelated reimport, which is what `mergeProjectIntoExisting`'s name-matching is for). Deliberately its own module with zero `@dbml/core` import, unlike `dbml.ts` — marked the package `"sideEffects": false` so bundlers can tree-shake the parser-instantiating module away when only `diffProjects` is imported (verified: web bundle grew ~3KB, not the ~11MB from when `@dbml/core` leaked in before). 15 unit tests. **Caveat found via live testing** (not the unit tests, which used hand-crafted stable ids): id-based matching can misattribute across two revisions produced by separate DBML reimports, since `@dbml/core` assigns fresh sequential ids per parse — a removed field and an unrelated added field at the same table position can coincidentally share an id and render as "changed" instead of "removed + added". Not a bug in the function given its contract, just a sharp edge inherited from DBML having no stable field identity (same root cause `mergeProjectIntoExisting`'s docs already call out).
- [x] Validation: circular refs, missing FK targets, duplicate table/field names — `validate.ts`: `validateProject(project)`, same pattern as `diff.ts` (own module, zero `@dbml/core` import, `sideEffects: false` lets bundlers tree-shake `dbml.ts` away — verified web bundle grew ~3KB, not megabytes). Informational only, never blocks: SQL export already emits FKs as separate `ALTER TABLE` statements after all `CREATE TABLE`s, so a circular ref doesn't actually break generation. Self-referencing tables (`employees.manager_id -> employees.id`) are explicitly excluded from the cycle check — common, valid pattern, not a mistake. Wired into the toolbar as a "Validate" button with a live issue-count badge. 8 unit tests; live-verified against a real imported schema with both a self-ref and a genuine 3-table cycle — only the real cycle was flagged.
- [x] Unit tests: fixtures for DBML<->SQL round trips per dialect — `dbml.test.ts` (9 tests, `node:test`, no new deps). Found two more real bugs of the same class as the ref-id one while writing them: (1) index `fieldIds` resolved to @dbml/core's column _name_ (`column.value`) instead of the field's actual id, so `projectToDbml`'s field lookup silently dropped every index with columns; (2) numeric field defaults (`default: 0`) come back from @dbml/core as a JS `number`, not a `string`, violating `Field.default`'s type — harmless today only because regex `.test()` coerces implicitly, but a real contract violation. Both fixed; live-verified the index fix through the actual import/export REST pipeline, not just the unit test.

## Phase 3 — Server (`apps/server`)

- [x] SQLite schema: projects, revisions (append-only log), snapshots (users/sessions not added yet — no real auth)
- [x] REST: CRUD projects, list revisions, GET snapshot (live doc via `readProjectFromDoc`), POST snapshot/restore (revert live doc to last persisted SQLite snapshot), POST import (SQL per dialect or DBML text, now merges by name via `mergeProjectIntoExisting` instead of a blind overwrite), GET export/dbml, GET export/sql?dialect=
- [x] WebSocket endpoint: Yjs doc sync per project room — hand-rolled with `y-protocols/sync` + `y-protocols/awareness` + `lib0` (not the `y-websocket` server package, for control over SQLite persistence)
- [x] Yjs doc <-> SQLite persistence: append-only `revisions` table (author + raw update bytes) + debounced `snapshots` table (full state); verified doc reconstructs correctly after server restart
- [x] Presence: `Awareness` wired and broadcast to all conns in a room; UI to show cursors/avatars still pending (Phase 6)
- [x] History service: `reconstructDocAtRevision` replays a project's revision log (in true insertion order — switched `listRevisions` from `created_at` to `rowid`, since same-second edits tied under 1s-resolution timestamps) up to any past revision into a scratch `Y.Doc`. Exposed as `GET /revisions/:revisionId` (read) and `POST /revisions/:revisionId/restore` (non-destructive: writes the reconstructed state into the live doc, which itself becomes a new revision) — the latter also covers Phase 7's restore/rollback.
- [x] Local auth: simple username; connections pass `?user=` (WS) — the "Open decisions" model below (`simple username, no external IdP`) means this is identity labeling for attribution/presence, not real authentication: nothing verifies "alice" is actually alice, anyone can claim any name. Extended the same `?user=` convention to the three REST routes that write to the doc (import, snapshot/restore, revision restore), which previously always recorded `"system"` as the revision author regardless of who actually triggered them from the web UI. Found a real bug live-testing this (not caught by any unit test, since it's in the WS/Room layer): `Room`'s `doc.on("update")` resolved the author by looking up `conns.get(origin)`, keyed by `WebSocket` — a REST-triggered write's origin is a plain username _string_, which just silently missed that lookup and fell through to `"system"` even though the route had already resolved the real username and passed it through correctly as the Yjs transaction's origin. Fixed by branching on `typeof origin === "string"`.
- [x] Static file serving of built `apps/web` for single-process local deployment — `@fastify/static` serves `apps/web/dist` when present (no-op in dev, where Vite's own server + proxy handles it)

## Phase 4 — Web editor shell (`apps/web`)

- [x] App shell: project list / open / create / import (import is a modal reachable from the editor toolbar, not the list view)
- [x] Yjs client provider wired to server WS, connect Yjs doc to canvas state — hand-rolled client (`yjsClient.ts`) mirroring the server's raw sync/awareness protocol; `useProjectDoc` hook exposes live `Project` state, canvas re-renders on remote change, "+ Table" writes straight into the shared doc. Verified with two concurrent simulated clients converging on a live edit. (The new lint config caught `doc`/`undoManager` being read from a ref during render in this hook — fragile, worked by luck of re-render timing. Fixed to real state.)
- [x] DBML source panel (Monaco editor) — live two-way sync with canvas: `DbmlPanel` in `App.tsx`, toggleable from the toolbar. Self-hosted Monaco (`monacoSetup.ts`): loader pointed at the locally-bundled `monaco-editor` instead of `@monaco-editor/react`'s CDN default (project is explicitly self-hosted per README), worker wired via Vite's `?worker` import, minimal Monarch tokenizer registered for `dbml` syntax highlighting. Imports the _core_ editor API (`monaco-editor/editor/editor.api`) rather than the full barrel, which auto-registers ~70 unused bundled languages — cut the built bundle from 4.4MB to 3.1MB. Panel reads/writes through the existing `/export/dbml` and `/import` REST routes rather than parsing client-side: `dbml-engine` instantiates an `@dbml/core` `Parser` at module scope, so importing even the pure-string `projectToDbml` from it would have pulled that whole parser library (~11MB) into the browser bundle. **Upgraded to genuinely real-time**: typing now auto-syncs to the canvas on a 600ms debounce instead of requiring a manual "Apply" click, with a small sync-status indicator (editing/syncing/synced/error) replacing the old dirty-flag gate. Live-timed end to end over the real WS+REST pipeline: ~630ms from "user stops typing" to "canvas visibly updated", almost entirely the intentional debounce (REST round-trip + WS broadcast measured at ~25ms). Known limitation: because parsing has to stay server-side, edits made here arrive back over the WebSocket like any remote change, so they fall outside the local `Y.UndoManager`'s tracked origins — Ctrl+Z undoes canvas edits but not DBML panel edits (only "Restore this revision" can revert them).
- [x] SQL import dialog (paste DBML or SQL, choose dialect) — `ImportDialog` in `App.tsx`, hits `POST /import`; no file-upload input yet, paste only
- [x] SQL export dialog (choose DBML/dialect, copy/download) — `ExportDialog` in `App.tsx`
- [~] Toolbar: zoom/fit-to-screen come free from React Flow's built-in `<Controls/>`; detail-level toggle (compact/standard/full, writes `table.detailLevel` for all tables) and undo/redo (`Y.UndoManager` scoped to the 5 editable maps + Ctrl+Z/Ctrl+Shift+Z) done — verified over the real WS protocol that local edits undo/redo while remote/imported changes are left alone. Node label rendering per detail level is a stand-in for the real per-Detail-Level Table node (Phase 5), and refs now render as plain React Flow edges table-to-table (no custom edge component yet)

## Phase 5 — Visual canvas (React Flow)

- [x] Custom Table node component, 3 render variants per Detail Level — `TableNode.tsx`: compact (name only), standard (PK + any field that's a ref endpoint), full (all fields + types), replacing last round's static `describeTable()` label. Also fixed a real gap this exposed: dragging a table had no persistence at all (`nodes` was a pure `useMemo` off `liveProject` with no `onNodesChange`, so a drag would silently snap back on the next unrelated re-render) — now local node state mirrors live drag position and commits to the `tables` Y.Map on drag-end only.
- [x] Custom Edge component for refs (1-1, 1-n, n-n), styling per relation type — `RefEdge.tsx`: distinct stroke color + dash pattern + label per cardinality, arrow marker colored to match. Edges attach to the specific field's `Handle` on `TableNode` (not just table-to-table) except when that table is in compact detail level, where no field rows are rendered so the edge falls back to the table's generic handle.
- [x] Draggable/resizable Zone node (colored bounding area/group, label) — `ZoneNode.tsx`: dashed-border tinted rectangle, double-click-to-rename label, color picker, resizable via `@xyflow/react`'s `NodeResizer` (visible when selected). Rendered first in the node array (bottom of the stack) so tables/notes drag on top of it rather than fighting it for pointer events.
- [x] Sticky note node (free text, color, resizable) — `StickyNoteNode.tsx`: colored box with a `textarea`, resizable, rendered last (top of the stack) as an annotation layer over the diagram.
- [x] Per-table color customization (header color, border) — inline `<input type="color">` in `TableNode`'s header, writes `table.style.color`/`.borderColor`; also added double-click-to-rename on the header while in there
- [ ] Manual edge routing: draggable waypoints, persisted per edge
- [x] Minimap + zoom controls — shipped two rounds ago (`<Controls/>`/`<MiniMap/>`), just hadn't been checked off here
- [x] Auto-layout command (initial placement for imported schemas, dagre or elk) — `autoLayout.ts`: `@dagrejs/dagre`, node size estimated from each table's actual visible-row-count (mirrors `TableNode`'s own row-visibility logic per detail level, so the layout roughly matches real rendered heights instead of guessing), edges from refs, `rankdir: "LR"`. Toolbar "Auto-layout" button batches all resulting position writes in one `doc.transact` (one revision, not one per table). Verified against the real function (not a mirror) on a 3-table ref chain: ranked correctly left-to-right by ref direction, all positions distinct.
- [x] Multi-select, group move, alignment guides — multi-select and group-move come free from React Flow's default Shift-click/marquee-select plus `applyNodeChanges` (our `onNodesChange` already commits each changed node's position generically, so a multi-node drag persists exactly like a single-node one); added `snapToGrid`/`snapGrid=[10,10]` as a lightweight stand-in for true dynamic alignment guides, which aren't implemented
- [x] Keyboard shortcuts (delete, duplicate, undo/redo, zoom) — delete via `deleteKeyCode={["Backspace","Delete"]}` (cascade-deletes refs pointing at the removed table), undo/redo from Phase 4, and now Ctrl+D duplicates every selected table/zone/note (new ids throughout, including remapped field/index ids for tables) batched in one `doc.transact` — verified live: transact produced exactly one new revision, not one per mutation. Zoom is mouse-wheel/pinch/`<Controls/>` only, no dedicated key binding

## Phase 6 — Multi-user editing

- [x] Live cursors / selection highlights per connected user (color-coded) — cursor position broadcast via Yjs Awareness (`awareness.setLocalStateField("cursor", ...)` from `CanvasArea`'s mousemove, converted through `useReactFlow().screenToFlowPosition` so it's in canvas-logical coordinates, not screen pixels). Remote cursors render as a `CursorNode` (non-interactive React Flow node — piggybacks on React Flow's own pan/zoom transform for free instead of hand-rolling screen-space math). Color is a deterministic hash of the username (`awarenessColor.ts`), so it's stable across reconnects. Selection highlighting not done (only cursor position).
- [x] Presence list UI (avatars/names of connected users) — `PresenceList.tsx` in the toolbar, backed by `useAwarenessStates` (subscribes to `Awareness`'s `change` event).
- [~] Conflict-free concurrent edits via Yjs (tables, fields, positions, notes all as Yjs shared types) — `yjsBinding.ts` gives per-entity (whole-table/ref/enum/zone/note) CRDT granularity today; concurrent edits to _different_ tables merge cleanly, but two users editing the same table's fields/position simultaneously will last-write-wins rather than merge field-by-field. Finer-grained nesting is a follow-up if that proves needed.
- [x] Awareness cleanup on disconnect — this was actually already implemented server-side since the original scaffold (`Room.leave()` calls `removeAwarenessStates`), it just had nothing to clean up because no client ever called `awareness.setLocalState(...)` until this round. Verified live: two simulated clients see each other's presence/cursor, then an _abrupt_ disconnect (`ws.terminate()`, not the graceful client-side path) still correctly triggers the server-side cleanup and the survivor sees the peer disappear.
- [ ] Optional: comment threads on tables/fields

## Phase 7 — History

- [x] History timeline UI: list of revisions/snapshots with author + timestamp — `HistoryPanel` in `App.tsx`, toolbar "History…" button. Lists revisions from `GET /revisions`, selecting one shows a read-only DBML preview (new export-at-revision route), "Restore this revision" hits the existing non-destructive restore endpoint. The backend for this (`reconstructDocAtRevision`, restore route) was actually built two rounds ago but had no UI at all until now — only reachable via raw REST calls.
- [x] Diff view between two revisions (schema-level: added/removed/changed tables/fields/refs) — `HistoryPanel` now shows a colored +/-/~ summary (`diffProjects` against the live current state) above the DBML preview for whichever revision is selected. Diffs the selected revision against current state, not two arbitrary past revisions against each other.
- [x] Restore/rollback to a revision (creates new revision, non-destructive) — `POST /api/projects/:id/revisions/:revisionId/restore` (Phase 3)
- [x] Named checkpoints ("v1.0", "before migration X") — the `revisions.label` column existed since the original scaffold but was never written to. `PATCH /api/projects/:id/revisions/:revisionId { label }` sets/clears it; `HistoryPanel`'s list shows the label (🏷) in place of the author line when set, with an inline input + "Label" button to name/rename the selected revision. Live-verified: set, list reflects it, clear, 404 for an unknown revision id.
- [x] Export revision as DBML/SQL snapshot — `GET /api/projects/:id/revisions/:revisionId/export/dbml` and `.../export/sql?dialect=`, mirroring the live export routes but reconstructing via `reconstructDocAtRevision` instead of the live room doc. Verified live across two revisions: DBML/SQL at an earlier revision correctly excludes a table added in a later one.

## Phase 8 — Personalization / visual polish

- [~] Theme: light/dark — full visual redesign this round: `index.css` design system (color/spacing/radius/shadow tokens, system font stack only — no CDN, same reasoning as the Monaco decision), a small hand-written SVG icon set (`Icons.tsx`) replacing emoji throughout, and every component (app shell, project list, toolbar, table/zone/sticky-note nodes, ref edges, presence avatars, all modals) restyled against it for a cohesive dbdiagram-like look. Light theme only — no dark variant or toggle yet, `--color-scheme: light` is hardcoded.
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

- [x] Unit tests: dbml-engine, shared model — `dbml.test.ts` (9 tests) + `yjsBinding.test.ts` (4 tests, round-trips a full `Project` through a real `Y.Doc` including cross-doc `encodeStateAsUpdate`/`applyUpdate` sync — the actual persistence path). Both run via `npm run test` at root (`--workspaces --if-present`). No integration/E2E tests yet.
- [ ] Integration tests: server REST + WS flows
- [ ] E2E test: create project, edit schema, reload, verify persistence (Playwright)
- [ ] User docs: getting started, DBML cheatsheet, keyboard shortcuts
- [ ] Contributing guide

---

## Open decisions (revisit as needed)

- Auth model for multi-user on LAN: none / simple username / basic password — currently planned as simple local username, no external IdP.
- Canvas library: React Flow chosen over building custom SVG/canvas engine, for speed; revisit if performance issues with very large schemas (500+ tables).
- History storage: Yjs update log + periodic SQLite snapshots, avoids storing full doc on every change.
- SQLite as a _SQL import/export dialect_ is not supported by `@dbml/core` (only postgres/mysql/mssql/snowflake/schemarb). SQLite is still used as AthanorDB's own storage engine (unrelated concern) — if SQLite DDL import/export is required later, needs a separate parser/generator.
