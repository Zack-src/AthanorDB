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

- [ ] Dockerfile + docker-compose (optional, for LAN multi-user hosting) — **confirmed broken** (re-audited 2026-07-30): `Dockerfile` only `COPY`s each workspace's `package.json` before `RUN npm ci` (lines 11-16); source and `tsconfig.json`/`tsconfig.base.json` aren't copied in until `COPY . .` on line 18, which runs *after* `npm ci`. But root `package.json`'s `postinstall` (`npm run build -w packages/shared && npm run build -w packages/dbml-engine`) fires during that `npm ci` and runs `tsc -p tsconfig.json` — which needs files that don't exist in the image yet. `docker compose up --build` fails during the image build step with a missing-tsconfig/file error. Fix: reorder so source is copied before `npm ci`, or disable `postinstall` for the Docker build and rely on the explicit `RUN npm run build` already on line 19.

## Phase 12 — Full codebase review: security, bugs, bundle size, modularity

- [~] Input length limits — `POST/PATCH /api/projects` name and team name are capped server-side (200 chars: `routes/projects.ts`, `routes/teams.ts`). **Gap found in re-audit (2026-07-30)**: table rename, zone label, sticky note text, and comment inputs are only capped via the HTML `maxLength` attribute client-side (`TableNode.tsx`, `ZoneNode.tsx`, `StickyNoteNode.tsx`, `CommentThread.tsx`); those edits travel as raw Yjs WS update frames (`Room.receive` in `apps/server/src/yjs/room.ts` only checks `canWrite`, never payload size), so a non-browser WS client can set an arbitrarily long table name/zone label/note/comment, bypassing the limit entirely. Needs a server-side length check in the Yjs update-application path.
- [~] Bundle size / code-splitting — `App.tsx` split into lazy-loaded panel modules (`DbmlPanel`/`ImportDialog`/`ExportDialog`/`HistoryPanel`/`ValidationPanel`), `html-to-image`/`jsPDF` dynamically imported. **Regression found in re-audit (2026-07-30)**: `DbmlPanel.tsx` now imports `projectToDbml` directly from `@athanordb/dbml-engine` for local live-diffing against fetched DBML text. `packages/dbml-engine/src/dbml.ts` instantiates `new Parser()` at module scope (line 6), so that import drags the entire `@dbml/core` parser into the lazy `DbmlPanel` chunk regardless — measured at 11.3MB raw / 1.79MB gzip (`apps/web/dist/assets/DbmlPanel-*.js`), i.e. exactly the anti-pattern this bullet's own original reasoning says was avoided by keeping DBML parsing server-side. Opening the DBML panel now downloads ~1.8MB gzip just for editor+parser. Fix: split `projectToDbml` into a module with no `Parser` import, or have `DbmlPanel` compute its diff via the `/export/dbml` REST response instead of calling `projectToDbml` locally.

## Phase 13 — Security hardening

Audited 2026-07-30. The auth/teams/invitations system (`apps/server/src/auth/*`, `apps/server/src/routes/{auth,invitations,teams,users}.ts`, `apps/server/src/permissions.ts`) has never had a security pass — items below are new findings, not regressions.

- [ ] No rate limiting / brute-force protection anywhere — `POST /api/auth/login` (`routes/auth.ts:15-39`) and the invitation-accept route (`routes/invitations.ts`) have no failed-attempt counter, delay, or lockout, and no `rate-limit` package is installed at all. Add `@fastify/rate-limit` (or equivalent) on login and invite-accept at minimum.
- [ ] scrypt cost factor below current guidance — `apps/server/src/auth/password.ts:16-18` uses N=16384 (2009-era minimum). OWASP currently recommends N=131072 for interactive login with the same r/p. Bump the cost factor (benchmark for ~250-500ms/hash) or document the tradeoff explicitly.
- [ ] No max password length — `password.ts` and its callers (`routes/auth.ts`, `routes/invitations.ts:88`, `routes/users.ts:59,88`) enforce only a minimum (8 chars). An attacker can submit a huge password on every login attempt, making each failed scrypt hash disproportionately expensive — a cheap CPU-amplification DoS lever, worse combined with the missing rate limit above. Cap at ~128 chars.
- [ ] No cleanup of expired sessions — `apps/server/src/auth/session.ts`: rows in `sessions` are only deleted on explicit logout or admin password reset; expired rows are never purged, so the table grows unbounded. Add a periodic sweep or delete-on-read-if-expired.
- [ ] Secure cookie flag is opt-in with no production safeguard — `session.ts:35` gates `secure` behind `ATHANORDB_COOKIE_SECURE === "true"` with no default and no startup warning if unset. An operator deploying behind TLS who forgets this env var gets no signal that cookies aren't marked `Secure`. Warn loudly at boot if unset, or default true and require an explicit opt-out for local HTTP dev.
- [ ] No CSRF defense beyond `SameSite=Lax` — `session.ts:30` relies solely on `sameSite: "lax"`; no Origin/Referer check anywhere in `index.ts` or the route files. Add an Origin-header check on state-changing routes as a second layer, since cookies are the sole auth mechanism.
- [ ] Invitation accept has a TOCTOU race — `routes/invitations.ts:77-105`: the pending-status check and the `INSERT`/`accepted_at` update aren't wrapped in a transaction, so two concurrent accepts of the same token can both pass the check; the second write throws unhandled on the `users.email` UNIQUE constraint, surfacing a raw 500. Wrap in `db.transaction`.
- [ ] Invitation delivery is fully manual, no email integration — `routes/invitations.ts:49` just returns `inviteUrl` as JSON for an admin to copy/paste through whatever channel they choose. Either add real email delivery (SMTP/nodemailer) or explicitly document the operational risk of hand-relaying a live account-creation credential.
- [ ] Weak email validation — `routes/auth.ts`, `routes/invitations.ts:31`, `bootstrap-admin.ts:21` all accept anything containing `"@"` (`"a@b@c"`, `"a@"` pass). Use a real email regex/library.
- [ ] Remove unused `monaco-editor`/`@monaco-editor/react` dependencies — nothing in `apps/web/src` imports Monaco anymore (replaced by CodeMirror 6, see Phase 4/8 history), but both packages are still listed in `apps/web/package.json`. `npm audit` currently reports a moderate-severity `dompurify` vulnerability pulled in transitively through the unused `monaco-editor`. Deleting the dead deps removes the vuln and the dead weight in one move.

## Phase 14 — Feature completeness (canvas / DBML)

Audited 2026-07-30 against DBML's full spec and comparable tools (dbdiagram.io). Concrete gaps, not speculative wishlist items.

- [ ] `TableGroup` blocks are a dead autocomplete entry with zero backing support — `codemirrorDbml.ts:254-255,271` offers the snippet, but `packages/dbml-engine/src/dbml.ts`'s `toProject`/`projectToDbml` never map `@dbml/core`'s `tableGroups` into AthanorDB's `Project` schema, and `CanvasArea.tsx`'s `nodeTypes` has no group node. A `TableGroup` block typed in the DBML panel silently disappears on the next round-trip. Needs a `TableGroup` entity in `packages/shared/src/schema.ts`, engine round-trip support, and canvas rendering.
- [ ] No visual editor for Enums — `CanvasArea.tsx`'s node types are `{ table, zone, sticky, cursor }`, no enum node anywhere. Enums fully round-trip through DBML (`dbml.ts`) but can only be created/edited by typing raw DBML text. Needs at minimum a panel or popover to add/rename/reorder enum values.
- [ ] No visual editor for indexes — `TableNode.tsx:427-434` only *reads* `table.indexes` to render PK badges; there's no add/edit/remove control for indexes (including non-PK/unique composite indexes). DBML-text-only today.
- [ ] Composite PK creation is read-only in the UI — `TableNode.tsx:339` only toggles a single field's `pk` boolean; composite PKs (2+ columns via a `table.indexes` entry with `pk:true`) render correctly but can't be built or edited from the canvas, only via raw DBML. The recent "composite-PK support" commit covers display/parsing, not creation — needs a UI control to add a field into a composite-PK group.
- [ ] No search — no way to find a table by name on a large canvas (no Ctrl+F/filter box) and no filter input on the project list (`ProjectList.tsx` only has archive/active/trash tabs). Matters more as schemas grow past the ~20-30 table range.
- [ ] WebSocket client has no reconnect logic — `apps/web/src/yjsClient.ts` has `open`/`message` listeners and a manual `disconnect()`, but no `close`/`error` listener and no reconnect-with-backoff. A server restart or network blip silently stops sync with no recovery short of a manual page reload — significant for a collaborative tool. Add reconnect-with-backoff plus a visible "reconnecting…" state.
- [ ] No large-schema rendering safeguards — `CanvasArea.tsx`'s `<ReactFlow>` has no `onlyRenderVisibleElements` and nothing else virtualizes node rendering. This is the concrete version of the "revisit if performance issues with 500+ tables" open decision below — worth prototyping before it becomes a real complaint.

## Phase 15 — Reliability & operations

Audited 2026-07-30. Gaps that matter for running this unattended as a real self-hosted service, beyond the already-tracked Dockerfile build bug (Phase 10).

- [ ] No graceful shutdown — no `process.on("SIGTERM"/"SIGINT")` anywhere in `apps/server/src`. `docker stop`/`docker-compose down` sends SIGTERM with nothing listening, so in-flight WS connections and any pending debounced snapshot write (`room.ts` snapshot timer) are dropped rather than flushed. WAL mode (`db.ts:10`) limits corruption risk but doesn't prevent losing the last few seconds of unsaved state.
- [ ] No global process-level error guard — no `process.on("uncaughtException"/"unhandledRejection")` anywhere. The WS `preHandler` fix in `index.ts:63-83` only covers the one incident it was written for (bad `projectId` crashing the server); any other uncaught exception inside `socket.on("message"/"close")` or elsewhere still takes down the whole process for every connected project, same failure class as the incident already documented in Phase 12's history.
- [ ] No real migration system — `db.ts:12-86` is `CREATE TABLE IF NOT EXISTS` plus a couple of hand-coded `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` checks (`db.ts:88-97`) for two specific columns. Works today, but any future schema change needs another one-off guarded `ALTER`, there's no schema-version tracking, and a forgotten check silently no-ops against existing production databases. Worth a minimal versioned-migrations table before the next schema change.
- [ ] Backup is one-way — `backup.ts` dumps all projects to DBML correctly (already verified), but there's no restore counterpart: no script/route to bulk-import a backup directory back in. The only import path is the single-project paste/upload route, which requires the project to already exist.
- [ ] No request/frame size limits tuned for this app — no `bodyLimit` set anywhere in `apps/server/src`, so the DBML/SQL import route relies on Fastify's untuned default (1MB); `@fastify/websocket` is registered with no `maxPayload` (`index.ts:19`), so a malicious or buggy client can send an arbitrarily large Yjs update frame. Set explicit limits on both.
- [ ] No startup config validation — `ATHANORDB_DB_PATH`, `PORT`, and `ATHANORDB_COOKIE_SECURE` all silently fall back to defaults with no fail-fast check for missing/malformed required config. Low risk today (all have sane defaults) but worth a single validation pass as more env vars get added.
- [ ] Docker container runs as root — no `USER` directive in `Dockerfile`. Add a non-root user for the final run stage.

## Phase 16 — Testing, docs & dev experience

Audited 2026-07-30. Beyond the already-tracked "no integration tests / no E2E / no user docs / no contributing guide" (Phase 11).

- [ ] Zero test coverage for the entire auth/teams/invitations system — `apps/server/src/auth/*`, `permissions.ts`, `routes/{auth,invitations,teams,users}.ts` (most of the server's business logic) have no test files at all, and `apps/server/package.json` has no `test` script, so `npm run test --workspaces` silently skips the server entirely. This is the highest-risk untested code in the app (password hashing, sessions, permission checks).
- [ ] Zero test coverage in `apps/web` — no test files, no test script, no testing-library/vitest installed. The entire canvas editor, DBML sync, and every React component are unverified by anything but manual testing.
- [ ] Lint is currently failing on main, not enforced — `npm run lint` reports 11 errors / 6 warnings today: `react-hooks/set-state-in-effect` in `TableNode.tsx:59,187`, 4x `@typescript-eslint/no-explicit-any` in `vite.config.ts`, `no-useless-escape` in `codemirrorDbml.ts:119`, plus unused-var/exhaustive-deps warnings in `RefEdge.tsx`/`codemirrorDbml.ts`. No husky/lint-staged pre-commit hook exists, so nothing currently blocks broken/unlinted code from landing.
- [ ] No CI at all — `.github` is empty. Nothing runs build/test/lint on push or PR.
- [ ] README doesn't document the auth system — no mention anywhere of login, admin, `bootstrap-admin` (exists, wired to `npm run bootstrap-admin`, but never documented — a new self-hoster has no documented way to create their first login), teams, or invitations. Also undocumented: `ATHANORDB_COOKIE_SECURE` env var. Only `ATHANORDB_DB_PATH`/`PORT` are covered.
- [ ] No LICENSE file, no `license` field in any `package.json` — legally unclear reuse/contribution terms.
- [ ] `@dbml/core` is 5 major versions behind (3.14.1 installed, 8.3.1 latest) — the core DBML parse/generate engine. Worth investigating for bugfixes/behavior changes before it drifts further; a jump this large will need careful regression testing against `dbml.test.ts`/`roundtrip.test.ts`.

---

## Open decisions (revisit as needed)

- Auth model: resolved — full email/password auth with sessions, per-project/team permissions, invitations, and an admin console are implemented (`apps/server/src/auth/*`, `apps/server/src/routes/{auth,invitations,teams,users}.ts`, `apps/web/src/{Login,AdminConsole,AcceptInvite,ChangePasswordModal,ProjectTeamsModal}.tsx`) — supersedes the earlier "simple username" plan. No external IdP integration.
- Canvas library: React Flow chosen over building custom SVG/canvas engine, for speed; revisit if performance issues with very large schemas (500+ tables).
- History storage: Yjs update log + periodic SQLite snapshots, avoids storing full doc on every change.
- SQLite as a _SQL import/export dialect_ is not supported by `@dbml/core` (only postgres/mysql/mssql/snowflake/schemarb). SQLite is still used as AthanorDB's own storage engine (unrelated concern) — if SQLite DDL import/export is required later, needs a separate parser/generator.
