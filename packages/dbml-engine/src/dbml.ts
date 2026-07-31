import { Parser, ModelExporter } from "@dbml/core";
import type { DetailLevel, Position, Project, Ref, Size, StickyNote, Table, VisualStyle, Zone } from "@athanordb/shared";

export type SqlDialect = "postgres" | "mysql" | "mssql";

const parser = new Parser();

/** Parse DBML source into @dbml/core's raw Database model. */
export function parseDbml(source: string) {
  return parser.parse(source, "dbmlv2");
}

/** Parse SQL DDL of a given dialect into @dbml/core's raw Database model. */
export function parseSql(source: string, dialect: SqlDialect) {
  return parser.parse(source, dialect);
}

/** Export @dbml/core's raw Database model to SQL DDL for a given dialect. */
export function toSql(database: any, dialect: SqlDialect): string {
  return ModelExporter.export(database, dialect, false);
}

export interface DbmlParseErrorInfo {
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

interface CompilerDiagnostic {
  message: string;
  location?: { start?: { line?: number; column?: number }; end?: { line?: number; column?: number } };
}

/** @dbml/core's `dbmlv2`/ANTLR parsers throw a `CompilerError` (`{ diags: CompilerDiagnostic[] }`, not a plain `Error` — no `.message` of its own) carrying 1-based line/column per diagnostic. Other failure paths (e.g. semantic validation in `Database`'s constructor) still throw plain `Error`s with no location. This normalizes either into one shape so callers always get a usable message, plus a line/column when the parser can pinpoint one. */
export function describeDbmlParseError(err: unknown): DbmlParseErrorInfo {
  const diags = (err as { diags?: CompilerDiagnostic[] } | null)?.diags;
  if (Array.isArray(diags) && diags.length > 0) {
    const first = diags[0];
    return {
      message: diags.map((d) => d.message).join("; "),
      line: first.location?.start?.line,
      column: first.location?.start?.column,
      endLine: first.location?.end?.line,
      endColumn: first.location?.end?.column,
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

// @dbml/core always creates a schema named "public" when the source doesn't
// declare one (its own DEFAULT_SCHEMA_NAME, hardcoded identically for every
// dialect — including mysql/mssql, which don't even have a "public" schema
// concept). It intends to track whether that name came from the source or
// was defaulted (a `hasDefaultSchema` flag), but the code paths that set it
// are commented out in the installed version, so it's always false and
// useless for that purpose. We recover the distinction ourselves by checking
// the raw source text for a literal "public."-qualified table declaration.
const IMPLICIT_SCHEMA_NAME = "public";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `source` explicitly qualifies `tableName` with `schemaName` (quoted or not, any of DBML/postgres/mysql/mssql's quoting styles). */
function isSchemaExplicitInSource(source: string, schemaName: string, tableName: string): boolean {
  const escSchema = escapeRegExp(schemaName);
  const escTable = escapeRegExp(tableName);
  const ident = (name: string) => `(?:"${name}"|\`${name}\`|\\[${name}\\]|${name})`;
  const pattern = new RegExp(`${ident(escSchema)}\\s*\\.\\s*${ident(escTable)}`, "i");
  return pattern.test(source);
}

/**
 * Convert @dbml/core's raw Database model into AthanorDB's internal Project
 * shape. Visual metadata (position/color/detail level) is not present in
 * DBML/SQL and is defaulted here; the editor fills it in on first layout.
 *
 * `source`, if given, is the raw DBML/SQL text that was parsed — used only
 * to detect whether a table's "public" schema was actually typed by the
 * user (kept) or is just @dbml/core's silent default (dropped), so a schema
 * never round-trips into text that never asked for it. Without `source`
 * (e.g. tests constructing a `Project` directly from a parsed model), a
 * table's schema is treated as implicit whenever it's the default name.
 */
export function toProject(database: any, projectName = "Untitled", source?: string): Project {
  const schema = database.schemas?.[0];
  const tables = (schema?.tables ?? []).map((table: any, index: number) => {
    const fields = (table.fields ?? []).map((field: any) => ({
      id: String(field.id ?? `${table.name}.${field.name}`),
      name: field.name,
      type: field.type?.type_name ?? String(field.type),
      pk: field.pk ?? false,
      unique: field.unique ?? false,
      notNull: field.not_null ?? false,
      increment: field.increment ?? false,
      // @dbml/core gives numeric defaults back as a JS number (e.g. `0`), not
      // a string, even though `Field.default` is typed `string` — coerce so
      // callers (e.g. `formatDefault` when re-serializing to DBML) get what
      // the type promises.
      default: field.dbdefault?.value !== undefined ? String(field.dbdefault.value) : undefined,
      note: field.note ?? undefined,
    }));
    // Index columns carry the column *name* (`column.value`), not a field
    // id — resolve through the fields we just built above so `fieldIds`
    // actually matches `field.id` (same bug class as the ref-endpoint fix
    // below: without this, projectToDbml's field lookup silently drops the
    // whole index). Falls back to the raw value for expression indexes
    // (e.g. `(lower(email))`), which have no corresponding field id.
    const fieldIdByName = new Map(fields.map((f: { id: string; name: string }) => [f.name, f.id]));
    const indexes = (table.indexes ?? []).map((idx: any) => ({
      id: String(idx.id ?? `${table.name}.idx`),
      fieldIds: (idx.columns ?? []).map((c: any) => fieldIdByName.get(c.value) ?? String(c.value ?? c)),
      unique: idx.unique ?? false,
      // @dbml/core normalizes a 2+ column `[pk]` into a composite index and
      // clears each field's own `pk` (see toProject's `fields` map above) —
      // without carrying this flag through, a composite primary key silently
      // becomes a plain, unmarked index and disappears from the UI entirely.
      pk: idx.pk ?? false,
      name: idx.name ?? undefined,
    }));

    const isExplicitSchema =
      schema?.name && schema.name !== IMPLICIT_SCHEMA_NAME
        ? true
        : Boolean(schema?.name && source && isSchemaExplicitInSource(source, schema.name, table.name));

    return {
      id: String(table.id ?? table.name),
      name: table.name,
      schemaName: isExplicitSchema ? schema.name : undefined,
      note: table.note ?? undefined,
      fields,
      indexes,
      position: { x: (index % 6) * 320, y: Math.floor(index / 6) * 400 },
      detailLevel: "standard" as const,
    };
  });

  const refs = (schema?.refs ?? []).map((ref: any, i: number) => {
    const [from, to] = ref.endpoints;
    // @dbml/core endpoints carry tableName/fieldNames, not the numeric ids
    // `toProject` assigns to tables/fields above — resolve through the
    // endpoint's actual Field object (`endpoint.fields[0].table.id`/`.id`)
    // instead, so refs point at the same ids the tables/fields use.
    const fromField = from.fields?.[0];
    const toField = to.fields?.[0];
    return {
      id: String(ref.id ?? `ref-${i}`),
      name: ref.name ?? undefined,
      from: {
        tableId: String(fromField?.table?.id ?? from.tableId ?? from.tableName),
        fieldId: String(fromField?.id ?? from.fieldId ?? from.fieldNames?.[0]),
      },
      to: {
        tableId: String(toField?.table?.id ?? to.tableId ?? to.tableName),
        fieldId: String(toField?.id ?? to.fieldId ?? to.fieldNames?.[0]),
      },
      cardinality: mapCardinality(ref.endpoints),
    };
  });

  const enums = (schema?.enums ?? []).map((e: any) => ({
    id: String(e.id ?? e.name),
    name: e.name,
    values: (e.values ?? []).map((v: any, i: number) => ({
      id: String(v.id ?? `${e.name}-${i}`),
      name: v.name,
      note: v.note ?? undefined,
    })),
  }));

  return {
    id: crypto.randomUUID(),
    name: projectName,
    tables,
    refs,
    enums,
    zones: [],
    stickyNotes: [],
  };
}

function mapCardinality(endpoints: any[]): "one-to-one" | "one-to-many" | "many-to-many" {
  const relations = endpoints.map((e) => e.relation);
  if (relations[0] === "1" && relations[1] === "1") return "one-to-one";
  if (relations[0] === "*" && relations[1] === "*") return "many-to-many";
  return "one-to-many";
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name: string): string {
  return IDENT_RE.test(name) ? name : `"${name.replace(/"/g, '\\"')}"`;
}

function quoteNoteText(note: string): string {
  return `'${note.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function formatDefault(value: string): string {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false|null)$/i.test(value)) return value.toLowerCase();
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function tableName(table: Table): string {
  return table.schemaName ? `${quoteIdent(table.schemaName)}.${quoteIdent(table.name)}` : quoteIdent(table.name);
}

const CARDINALITY_SYMBOL: Record<Ref["cardinality"], string> = {
  "one-to-one": "-",
  "one-to-many": ">",
  "many-to-many": "<>",
};

function fieldNameById(tables: Table[], tableId: string, fieldId: string): { table: string; field: string } | null {
  const table = tables.find((t) => t.id === tableId);
  const field = table?.fields.find((f) => f.id === fieldId);
  if (!table || !field) return null;
  return { table: table.name, field: field.name };
}

/**
 * DBML has no native field for position/color/detail-level/zones/sticky
 * notes, so a plain `.dbml` export/reimport round trip used to drop all of
 * it. `mergeProjectIntoExisting` already covers the common case (reimporting
 * into the *same* project preserves its live state by matching names) but
 * that's no help for a standalone file leaving the app and coming back into
 * a fresh project later, or being handed to someone else's instance.
 *
 * This sidecar is a single trailing `//`-comment line holding a compact JSON
 * blob, keyed by table *name* (the same stable key `mergeProjectIntoExisting`
 * already uses) — a plain comment, so any DBML/SQL tool that doesn't know
 * about it just ignores it. Opt-in on export (see `projectToDbml`'s
 * `includeVisualMetadata` option) so the live-editing DBML panel's text stays
 * clean; always attempted on import, since a pasted-in file either has it or
 * it's a harmless no-op.
 */
const VISUAL_METADATA_MARKER = "// athanordb:visual ";

interface VisualMetadataV1 {
  tables?: Record<string, { position?: Position; size?: Size; style?: VisualStyle; detailLevel?: DetailLevel }>;
  zones?: Zone[];
  stickyNotes?: StickyNote[];
}

/** Reads the sidecar visual-metadata blob out of raw DBML source, if present. Never throws — a missing or malformed marker just yields no metadata. */
export function extractVisualMetadata(source: string): VisualMetadataV1 | null {
  const line = source.split("\n").find((l) => l.startsWith(VISUAL_METADATA_MARKER));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(VISUAL_METADATA_MARKER.length));
  } catch {
    return null;
  }
}

/** Overlays sidecar visual metadata (if any) from raw DBML source onto an already-parsed `Project`, matching tables by name. */
export function applyVisualMetadata(project: Project, source: string): Project {
  const meta = extractVisualMetadata(source);
  if (!meta) return project;
  const tables = project.tables.map((table) => {
    const m = meta.tables?.[table.name];
    if (!m) return table;
    return {
      ...table,
      position: m.position ?? table.position,
      size: m.size ?? table.size,
      style: m.style ?? table.style,
      detailLevel: m.detailLevel ?? table.detailLevel,
    };
  });
  return {
    ...project,
    tables,
    zones: meta.zones ?? project.zones,
    stickyNotes: meta.stickyNotes ?? project.stickyNotes,
  };
}

/**
 * Convert AthanorDB's internal `Project` shape into DBML source text.
 * Round-trips table/field/index/ref/enum structure natively; pass
 * `includeVisualMetadata` to also append the sidecar comment (see above) so
 * position/color/detail-level/zones/sticky notes survive a save-to-file and
 * later reimport too.
 */
export function projectToDbml(project: Project, options?: { includeVisualMetadata?: boolean }): string {
  const parts: string[] = [];

  for (const table of project.tables) {
    const lines: string[] = [`Table ${tableName(table)} {`];

    for (const field of table.fields) {
      const settings: string[] = [];
      if (field.pk) settings.push("pk");
      if (field.unique) settings.push("unique");
      if (field.notNull) settings.push("not null");
      if (field.increment) settings.push("increment");
      if (field.default !== undefined) settings.push(`default: ${formatDefault(field.default)}`);
      if (field.note) settings.push(`note: ${quoteNoteText(field.note)}`);
      const settingsStr = settings.length ? ` [${settings.join(", ")}]` : "";
      lines.push(`  ${quoteIdent(field.name)} ${field.type}${settingsStr}`);
    }

    for (const idx of table.indexes) {
      if (idx.fieldIds.length === 0) continue;
      const cols = idx.fieldIds
        .map((fid) => table.fields.find((f) => f.id === fid)?.name)
        .filter((n): n is string => Boolean(n));
      if (cols.length === 0) continue;
      const idxSettings: string[] = [];
      if (idx.pk) idxSettings.push("pk");
      if (idx.unique) idxSettings.push("unique");
      if (idx.name) idxSettings.push(`name: ${quoteNoteText(idx.name)}`);
      const idxSettingsStr = idxSettings.length ? ` [${idxSettings.join(", ")}]` : "";
      lines.push(`\n  indexes {`, `    (${cols.join(", ")})${idxSettingsStr}`, `  }`);
    }

    if (table.note) {
      lines.push("", `  Note: ${quoteNoteText(table.note)}`);
    }

    lines.push("}");
    parts.push(lines.join("\n"));
  }

  for (const e of project.enums) {
    const lines: string[] = [`Enum ${quoteIdent(e.name)} {`];
    for (const v of e.values) {
      lines.push(v.note ? `  ${quoteIdent(v.name)} [note: ${quoteNoteText(v.note)}]` : `  ${quoteIdent(v.name)}`);
    }
    lines.push("}");
    parts.push(lines.join("\n"));
  }

  for (const ref of project.refs) {
    const from = fieldNameById(project.tables, ref.from.tableId, ref.from.fieldId);
    const to = fieldNameById(project.tables, ref.to.tableId, ref.to.fieldId);
    if (!from || !to) continue;
    const symbol = CARDINALITY_SYMBOL[ref.cardinality];
    const prefix = ref.name ? `Ref ${quoteIdent(ref.name)}:` : "Ref:";
    parts.push(`${prefix} ${from.table}.${from.field} ${symbol} ${to.table}.${to.field}`);
  }

  if (options?.includeVisualMetadata) {
    const metadata: VisualMetadataV1 = {
      tables: Object.fromEntries(
        project.tables.map((table) => [
          table.name,
          { position: table.position, size: table.size, style: table.style, detailLevel: table.detailLevel },
        ]),
      ),
      zones: project.zones,
      stickyNotes: project.stickyNotes,
    };
    parts.push(`${VISUAL_METADATA_MARKER}${JSON.stringify(metadata)}`);
  }

  return parts.join("\n\n") + "\n";
}

/** Convert internal `Project` directly to SQL DDL for a dialect, via DBML as the intermediate representation. */
export function projectToSql(project: Project, dialect: SqlDialect): string {
  const dbml = projectToDbml(project);
  const database = parseDbml(dbml);
  return toSql(database, dialect);
}

/**
 * Reconciles a freshly-parsed `incoming` project (from `toProject`, whose ids
 * are just @dbml/core's parse-order assignments, optionally already overlaid
 * with sidecar visual metadata via `applyVisualMetadata`) into `existing`,
 * matching tables/fields by *name* so ids survive a reimport instead of
 * resetting every time. `existing`'s own position/size/style/detail-level/
 * comments win when a table already has them; `incoming`'s (grid-default, or
 * sidecar-restored if the source carried one; comments are DBML-native never,
 * so always `undefined` on `incoming`) only fill in for genuinely new tables.
 * Same idea for zones/sticky notes, which have no per-table anchor to match
 * by: `existing`'s take priority, `incoming`'s (sidecar-only, never
 * DBML-native) only seed a project that doesn't have any yet. Refs and enums
 * carry no visual metadata (yet) and are taken wholesale from `incoming`,
 * remapped onto the merged ids.
 */
const GRID_COL_WIDTH = 320;
const GRID_ROW_HEIGHT = 400;
const positionKey = (p: Position) => `${Math.round(p.x)},${Math.round(p.y)}`;

export function mergeProjectIntoExisting(existing: Project, incoming: Project): Project {
  const existingTablesByName = new Map(existing.tables.map((t) => [t.name, t]));
  const tableIdRemap = new Map<string, string>();
  const fieldIdRemap = new Map<string, string>();

  // Grid slot for a genuinely new table, skipping whatever's already occupied
  // by an existing table's saved position — otherwise a new table dropped
  // between two others reuses the same declaration-order index one of those
  // already-placed tables was originally given, and lands stacked exactly on
  // top of it instead of appearing where the user can see it.
  const occupiedSlots = new Set(existing.tables.map((t) => positionKey(t.position)));
  let nextSlot = 0;
  const pickFreePosition = (): Position => {
    let pos = { x: (nextSlot % 6) * GRID_COL_WIDTH, y: Math.floor(nextSlot / 6) * GRID_ROW_HEIGHT };
    while (occupiedSlots.has(positionKey(pos))) {
      nextSlot++;
      pos = { x: (nextSlot % 6) * GRID_COL_WIDTH, y: Math.floor(nextSlot / 6) * GRID_ROW_HEIGHT };
    }
    occupiedSlots.add(positionKey(pos));
    nextSlot++;
    return pos;
  };
  // A new table's incoming position is either a sidecar-restored one
  // (legitimate, keep it) or `toProject`'s declaration-order grid default
  // (only free of collisions by coincidence) — try it as-is first, and only
  // fall back to hunting for a free slot if it's actually taken.
  const reservePosition = (candidate: Position): Position => {
    if (!occupiedSlots.has(positionKey(candidate))) {
      occupiedSlots.add(positionKey(candidate));
      return candidate;
    }
    return pickFreePosition();
  };

  const tables: Table[] = incoming.tables.map((table) => {
    const prev = existingTablesByName.get(table.name);
    // @dbml/core's `table.id` is just this parse's declaration-order position
    // (1, 2, 3...), not a stable identity — reusing it for a genuinely new
    // table risks colliding with an unrelated existing table's already-
    // assigned stable id the moment a table gets inserted before others (every
    // later table's positional number shifts by one). A fresh random id has
    // no such collision.
    const finalId = prev?.id ?? crypto.randomUUID();
    tableIdRemap.set(table.id, finalId);

    const prevFieldsByName = new Map((prev?.fields ?? []).map((f) => [f.name, f]));
    const fields = table.fields.map((field) => {
      // Same reasoning as `finalId` above, one level down: @dbml/core's
      // `field.id` is also just a positional counter, not a stable identity.
      const finalFieldId = prevFieldsByName.get(field.name)?.id ?? crypto.randomUUID();
      fieldIdRemap.set(field.id, finalFieldId);
      return { ...field, id: finalFieldId };
    });
    const indexes = table.indexes.map((idx) => ({
      ...idx,
      fieldIds: idx.fieldIds.map((fid) => fieldIdRemap.get(fid) ?? fid),
    }));

    return {
      ...table,
      id: finalId,
      fields,
      indexes,
      position: prev?.position ?? reservePosition(table.position),
      size: prev?.size ?? table.size,
      style: prev?.style ?? table.style,
      detailLevel: prev?.detailLevel ?? table.detailLevel,
      // Comments have no DBML equivalent (like zones/sticky notes) — without
      // this, every DBML-driven resync (which happens on nearly every canvas
      // edit, via the live auto-sync loop) would silently wipe them, since
      // `toProject` never populates this field at all.
      comments: prev?.comments ?? table.comments,
    };
  });

  const refs: Ref[] = incoming.refs.map((ref) => ({
    ...ref,
    from: {
      tableId: tableIdRemap.get(ref.from.tableId) ?? ref.from.tableId,
      fieldId: fieldIdRemap.get(ref.from.fieldId) ?? ref.from.fieldId,
    },
    to: {
      tableId: tableIdRemap.get(ref.to.tableId) ?? ref.to.tableId,
      fieldId: fieldIdRemap.get(ref.to.fieldId) ?? ref.to.fieldId,
    },
  }));

  return {
    id: existing.id,
    name: existing.name,
    tables,
    refs,
    enums: incoming.enums,
    zones: existing.zones.length > 0 ? existing.zones : incoming.zones,
    stickyNotes: existing.stickyNotes.length > 0 ? existing.stickyNotes : incoming.stickyNotes,
  };
}
