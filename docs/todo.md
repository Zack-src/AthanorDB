# AthanorDB — TODO

DBML-native, self-hosted, multi-user, versioned, visual editor.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done

---

## Phase 2 — DBML engine (`packages/dbml-engine`)

- [~] SQL import: Postgres / MySQL / SQL Server -> internal model (via `@dbml/core`). Note: `@dbml/core` has no SQLite dialect support, dropped from scope unless we add a separate SQLite DDL parser

## Phase 6 — Multi-user editing

- [~] Conflict-free concurrent edits via Yjs (tables, fields, positions, notes all as Yjs shared types) — `yjsBinding.ts` gives per-entity (whole-table/ref/enum/zone/note) CRDT granularity today; concurrent edits to _different_ tables merge cleanly, but two users editing the same table's fields/position simultaneously will last-write-wins rather than merge field-by-field. Finer-grained nesting is a follow-up if that proves needed.

## Phase 8 — Personalization / visual polish

- [~] Theme: light/dark — dark design system (dbdiagram-like reference look) shipped (`index.css`, `color-scheme: dark`); still single-theme only — no light variant or toggle.

## Phase 9 — Import/Export completeness

- [~] Import: raw SQL DDL (multi-dialect) and DBML both already worked via paste; `ImportDialog` now also has a "Choose file…" button (`.dbml`/`.sql`/`.txt`) that reads the file client-side and auto-picks DBML vs. a starting SQL dialect from the extension (user can still override the dialect dropdown). Live-verified both a `.dbml` and a `.sql` upload actually import. Reverse-engineer from a live DB connection remains the explicit stretch goal — out of scope for now (would need a DB driver, credential handling, and real security review for accepting arbitrary connection strings).

## Phase 10 — Packaging & deployment

- [x] Dockerfile + docker-compose (optional, for LAN multi-user hosting) — **fixed 2026-07-31**: `npm ci --ignore-scripts && npm rebuild better-sqlite3` skips the root `postinstall` (which ran `tsc` against sources not yet in the image and failed the build) while keeping better-sqlite3's native compile; the explicit `RUN npm run build` after `COPY . .` covers shared/dbml-engine as before, so the manifests-first layer caching is preserved. Also added a non-root `USER node` (with `/data` pre-created and chowned so the named volume inherits it) and a `HEALTHCHECK` hitting `/api/health`. Not yet verified by an actual `docker compose up --build` run — no Docker daemon on the dev machine this was fixed from.

## Phase 12 — Full codebase review: security, bugs, bundle size, modularity

- [~] Input length limits — `POST/PATCH /api/projects` name and team name are capped server-side (200 chars: `routes/projects.ts`, `routes/teams.ts`). **Gap found in re-audit (2026-07-30)**: table rename, zone label, sticky note text, and comment inputs are only capped via the HTML `maxLength` attribute client-side (`TableNode.tsx`, `ZoneNode.tsx`, `StickyNoteNode.tsx`, `CommentThread.tsx`); those edits travel as raw Yjs WS update frames (`Room.receive` in `apps/server/src/yjs/room.ts` only checks `canWrite`, never payload size), so a non-browser WS client can set an arbitrarily long table name/zone label/note/comment, bypassing the limit entirely. Needs a server-side length check in the Yjs update-application path.
- [x] Bundle size / code-splitting — `App.tsx` split into lazy-loaded panel modules (`DbmlPanel`/`ImportDialog`/`ExportDialog`/`HistoryPanel`/`ValidationPanel`), `html-to-image`/`jsPDF` dynamically imported. The 2026-07-30 regression (DBML panel pulling the whole `@dbml/core` parser — 11.3MB raw / 1.79MB gzip — because `projectToDbml` lived in `dbml.ts` next to a module-scope `new Parser()`) is **fixed (2026-07-31)**: serialization moved to `packages/dbml-engine/src/serialize.ts`, a parser-free module in the same spirit as `diff.ts`/`validate.ts`; `dbml.ts` now imports `projectToDbml` from it for `projectToSql`. `DbmlPanel` chunk is back to **465kB raw / 152kB gzip**. Keep serialization parser-free — anything the web imports from the engine must not reach `dbml.ts`.

## Phase 13 — Security hardening

Audited 2026-07-30. The auth/teams/invitations system (`apps/server/src/auth/*`, `apps/server/src/routes/{auth,invitations,teams,users}.ts`, `apps/server/src/permissions.ts`) has never had a security pass — items below are new findings, not regressions.

- [x] No rate limiting / brute-force protection anywhere — done 2026-07-31: `@fastify/rate-limit` registered with `global: false` (loose 300/min ceiling) plus per-route limits of **10/minute per IP** on `POST /api/auth/login` and `POST /api/invitations/:token/accept`. Verified live: 12 rapid login attempts returned 10x401 then 429.
- [x] scrypt cost factor below current guidance — bumped 2026-07-31 from N=16384 to **N=65536** (r=8, p=1), with `maxmem` raised since Node's 32MB default rejects it. Measured on the dev machine: 16384=26ms/16MB, 32768=49ms/32MB, 65536=103ms/64MB, 131072=208ms/128MB. Deliberately one step below OWASP's N=2^17, documented in `password.ts`: 128MB *per concurrent hash* is a memory-exhaustion lever on the 1-2GB boxes this gets self-hosted on, and the gap is covered on the other side by the new rate limit + password length cap.
- [x] No max password length — done 2026-07-31: `MAX_PASSWORD_LENGTH = 128`, enforced through a single `checkPassword()` helper shared by invite-accept, both password-change routes and `bootstrap-admin`. Login rejects over-length input *before* hashing (verified: a 5000-char password returns 401 immediately) and `verifyPassword` refuses it as a second layer.
- [x] No cleanup of expired sessions — done 2026-07-31: `purgeExpiredSessions()` in `auth/session.ts`, run at boot and hourly from an `unref`'d interval. Verified: expired row deleted, live row untouched.
- [x] Secure cookie flag is opt-in with no production safeguard — done 2026-07-31: env reading moved into `config.ts`, which warns loudly at boot when `NODE_ENV=production` and `ATHANORDB_COOKIE_SECURE` is unset, and hard-fails on any value other than `true`/`false`. Documented in the README config table.
- [x] No CSRF defense beyond `SameSite=Lax` — done 2026-07-31: an `onRequest` hook rejects any non-GET/HEAD/OPTIONS request whose `Origin` doesn't match the request `Host` (or `ATHANORDB_ALLOWED_ORIGINS`). A missing `Origin` still passes, so curl/scripts/backup tooling keep working; the Vite dev proxy preserves `Host`, so dev is unaffected. Verified live: cross-origin POST 403, same-origin POST normal, cross-origin GET 200.
- [x] Invitation accept has a TOCTOU race — fixed 2026-07-31: the accept claims the token inside a `db.transaction` with a conditional `UPDATE ... WHERE accepted_at IS NULL`, re-checks the email, and only then inserts. The loser of a race gets a clean 409 instead of an unhandled UNIQUE-constraint 500.
- [~] Invitation delivery is fully manual, no email integration — `routes/invitations.ts` still just returns `inviteUrl` as JSON for an admin to relay by hand. The documentation half of this is done (2026-07-31): the README's "Accounts, teams and invitations" section states outright that there is no email delivery and that the link is a live account-creation credential to be sent over a trusted channel. Real SMTP/nodemailer delivery remains optional/unbuilt.
- [x] Weak email validation — done 2026-07-31: `auth/email.ts` (`isValidEmail`/`normalizeEmail`, 254-char cap, documented RFC-subset regex) used by login, invitation creation and `bootstrap-admin`. Verified: `a@b@c` is now rejected.
- [x] Remove unused `monaco-editor`/`@monaco-editor/react` dependencies — done 2026-07-31: both deps uninstalled (5 packages removed) and the stale `.monaco-editor` selectors dropped from `useEditorKeyboardShortcuts.ts`/`useEdgeRouting.ts`. `dompurify` turned out to also come in via `jspdf`, so `npm audit fix` (non-breaking) bumped it too. Remaining audit finding is `esbuild <=0.24.2` via `vite <=6.4.2` — dev-server-only, and fixing it means a Vite 8 major upgrade, tracked separately if we take it.

## Phase 14 — Feature completeness (canvas / DBML)

Audited 2026-07-30 against DBML's full spec and comparable tools (dbdiagram.io). Concrete gaps, not speculative wishlist items.

- [ ] `TableGroup` blocks are a dead autocomplete entry with zero backing support — `dbmlEditor/completion.ts` offers the snippet (and `dbmlEditor/symbols.ts` parses groups for go-to-definition/outline), but `packages/dbml-engine/src/dbml.ts`'s `toProject`/`projectToDbml` never map `@dbml/core`'s `tableGroups` into AthanorDB's `Project` schema, and `CanvasArea.tsx`'s `nodeTypes` has no group node. A `TableGroup` block typed in the DBML panel silently disappears on the next round-trip. Needs a `TableGroup` entity in `packages/shared/src/schema.ts`, engine round-trip support, and canvas rendering.
- [ ] No visual editor for Enums — `CanvasArea.tsx`'s node types are `{ table, zone, sticky, cursor }`, no enum node anywhere. Enums fully round-trip through DBML (`dbml.ts`) but can only be created/edited by typing raw DBML text. Needs at minimum a panel or popover to add/rename/reorder enum values.
- [ ] No visual editor for indexes — `TableNode.tsx:427-434` only *reads* `table.indexes` to render PK badges; there's no add/edit/remove control for indexes (including non-PK/unique composite indexes). DBML-text-only today.
- [ ] Composite PK creation is read-only in the UI — `TableNode.tsx:339` only toggles a single field's `pk` boolean; composite PKs (2+ columns via a `table.indexes` entry with `pk:true`) render correctly but can't be built or edited from the canvas, only via raw DBML. The recent "composite-PK support" commit covers display/parsing, not creation — needs a UI control to add a field into a composite-PK group.
- [~] No search — the DBML panel now has find/replace (Ctrl+F, Ctrl+H), go-to-symbol (Ctrl+P: tables/columns/enums/refs) and go-to-definition, so text-side search is covered. Still missing: finding/highlighting a table by name **on the canvas** (no Ctrl+F/filter box in `CanvasArea.tsx`) and a filter input on the project list (`ProjectList.tsx` only has archive/active/trash tabs). Matters more as schemas grow past the ~20-30 table range.
- [ ] WebSocket client has no reconnect logic — `apps/web/src/yjsClient.ts` has `open`/`message` listeners and a manual `disconnect()`, but no `close`/`error` listener and no reconnect-with-backoff. A server restart or network blip silently stops sync with no recovery short of a manual page reload — significant for a collaborative tool. Add reconnect-with-backoff plus a visible "reconnecting…" state.
- [ ] No large-schema rendering safeguards — `CanvasArea.tsx`'s `<ReactFlow>` has no `onlyRenderVisibleElements` and nothing else virtualizes node rendering. This is the concrete version of the "revisit if performance issues with 500+ tables" open decision below — worth prototyping before it becomes a real complaint.

## Phase 15 — Reliability & operations

Audited 2026-07-30. Gaps that matter for running this unattended as a real self-hosted service, beyond the already-tracked Dockerfile build bug (Phase 10).

- [x] No graceful shutdown — done 2026-07-31: SIGTERM/SIGINT handlers stop the session sweep, run `flushAllRooms()` (new `Room.flush()` cancels the debounce and snapshots immediately), `closeAllRooms()`, `app.close()`, `db.close()`, with a 10s forced-exit ceiling. Flush path verified directly: an edit made <2s before flush lands in the snapshot and survives a reload. Signal *delivery* could not be exercised here (Windows dev box — Node doesn't receive real SIGTERM), so one live `docker stop` check on Linux is still owed.
- [x] No global process-level error guard — done 2026-07-31: `uncaughtException` logs, flushes every room's state to SQLite and **keeps the process alive** (documented tradeoff: for a collaborative server, dropping every other project's session is strictly worse than continuing degraded, and the known failure paths are already isolated per-connection); `unhandledRejection` logs.
- [ ] No real migration system — `db.ts:12-86` is `CREATE TABLE IF NOT EXISTS` plus a couple of hand-coded `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` checks (`db.ts:88-97`) for two specific columns. Works today, but any future schema change needs another one-off guarded `ALTER`, there's no schema-version tracking, and a forgotten check silently no-ops against existing production databases. Worth a minimal versioned-migrations table before the next schema change.
- [ ] Backup is one-way — `backup.ts` dumps all projects to DBML correctly (already verified), but there's no restore counterpart: no script/route to bulk-import a backup directory back in. The only import path is the single-project paste/upload route, which requires the project to already exist.
- [x] No request/frame size limits tuned for this app — done 2026-07-31: `bodyLimit` 4MB (up from Fastify's 1MB default, for large DBML/SQL imports) and WebSocket `maxPayload` 8MB, both overridable via `ATHANORDB_MAX_BODY_MB` / `ATHANORDB_MAX_WS_FRAME_MB`.
- [x] No startup config validation — done 2026-07-31: `apps/server/src/config.ts` is the only place reading `process.env` now, validating every value and exiting with a `[config] ...` message on anything malformed. Verified: `PORT=abc`, `PORT=99999` and `ATHANORDB_COOKIE_SECURE=maybe` each exit 1 with a clear message; an uncreatable `ATHANORDB_DB_PATH` fails the same way in `db.ts`.
- [x] Docker container runs as root — fixed 2026-07-31 alongside the Phase 10 build fix: `USER node`, with `/app` and `/data` chowned first.

## Phase 16 — Testing, docs & dev experience

Audited 2026-07-30. Beyond the already-tracked "no integration tests / no E2E / no user docs / no contributing guide" (Phase 11).

- [ ] Zero test coverage for the entire auth/teams/invitations system — `apps/server/src/auth/*`, `permissions.ts`, `routes/{auth,invitations,teams,users}.ts` (most of the server's business logic) have no test files at all, and `apps/server/package.json` has no `test` script, so `npm run test --workspaces` silently skips the server entirely. This is the highest-risk untested code in the app (password hashing, sessions, permission checks).
- [ ] Zero test coverage in `apps/web` — no test files, no test script, no testing-library/vitest installed. The entire canvas editor, DBML sync, and every React component are unverified by anything but manual testing.
- [ ] Lint is currently failing on main, not enforced — `npm run lint` reports 10 errors / 3 warnings (re-measured 2026-07-31, down from 11/6): `react-hooks/set-state-in-effect` in `ColorSwatchPicker.tsx:58`, `hooks/useProjects.ts:27`, `table/FieldEditorPopover.tsx:43`, `table/TableSettingsPopover.tsx:38`; `App.tsx:18` use-before-declare; `CanvasArea.tsx:226` "value cannot be modified"; 4x `@typescript-eslint/no-explicit-any` in `vite.config.ts`; plus exhaustive-deps warnings in `CanvasArea.tsx` and one unused eslint-disable in `useProjects.ts`. No husky/lint-staged pre-commit hook exists, so nothing currently blocks broken/unlinted code from landing.
- [ ] No CI at all — `.github` is empty. Nothing runs build/test/lint on push or PR.
- [x] README doesn't document the auth system — done 2026-07-31: added an "Accounts, teams and invitations" section (login/session model, invitation flow *including* the explicit warning that there is no email delivery and the link is a live credential, team scoping, admin powers) plus a configuration table covering every env var (`ATHANORDB_DB_PATH`, `PORT`, `ATHANORDB_COOKIE_SECURE`, `ATHANORDB_ALLOWED_ORIGINS`, `ATHANORDB_MAX_BODY_MB`, `ATHANORDB_MAX_WS_FRAME_MB`) and the graceful-shutdown behaviour.
- [ ] No LICENSE file, no `license` field in any `package.json` — legally unclear reuse/contribution terms.
- [ ] `@dbml/core` is 5 major versions behind (3.14.1 installed, 8.3.1 latest) — the core DBML parse/generate engine. Worth investigating for bugfixes/behavior changes before it drifts further; a jump this large will need careful regression testing against `dbml.test.ts`/`roundtrip.test.ts`.

---

## Open decisions (revisit as needed)

- Auth model: resolved — full email/password auth with sessions, per-project/team permissions, invitations, and an admin console are implemented (`apps/server/src/auth/*`, `apps/server/src/routes/{auth,invitations,teams,users}.ts`, `apps/web/src/{Login,AdminConsole,AcceptInvite,ChangePasswordModal,ProjectTeamsModal}.tsx`) — supersedes the earlier "simple username" plan. No external IdP integration.
- Canvas library: React Flow chosen over building custom SVG/canvas engine, for speed; revisit if performance issues with very large schemas (500+ tables).
- History storage: Yjs update log + periodic SQLite snapshots, avoids storing full doc on every change.
- SQLite as a _SQL import/export dialect_ is not supported by `@dbml/core` (only postgres/mysql/mssql/snowflake/schemarb). SQLite is still used as AthanorDB's own storage engine (unrelated concern) — if SQLite DDL import/export is required later, needs a separate parser/generator.
