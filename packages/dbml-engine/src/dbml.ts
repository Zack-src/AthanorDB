import { Parser, ModelExporter } from "@dbml/core";
import type { Project, Ref, Table } from "@athanordb/shared";

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

/**
 * Convert @dbml/core's raw Database model into AthanorDB's internal Project
 * shape. Visual metadata (position/color/detail level) is not present in
 * DBML/SQL and is defaulted here; the editor fills it in on first layout.
 */
export function toProject(database: any, projectName = "Untitled"): Project {
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
      name: idx.name ?? undefined,
    }));

    return {
      id: String(table.id ?? table.name),
      name: table.name,
      schemaName: schema?.name,
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
 * Convert AthanorDB's internal `Project` shape into DBML source text.
 * Round-trips table/field/index/ref/enum structure; visual metadata
 * (position, color, detail level, zones, sticky notes) has no DBML
 * equivalent yet and is dropped here.
 */
export function projectToDbml(project: Project): string {
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
 * are just @dbml/core's parse-order assignments) into `existing`, matching
 * tables/fields by *name* so ids, positions, sizes, styles, and detail level
 * survive a reimport instead of resetting every time. New tables/fields get
 * fresh positions; tables/fields no longer present in `incoming` are dropped.
 * Zones and sticky notes have no DBML equivalent, so they pass through from
 * `existing` untouched. Refs and enums carry no visual metadata (yet) and are
 * taken wholesale from `incoming`, remapped onto the merged ids.
 */
export function mergeProjectIntoExisting(existing: Project, incoming: Project): Project {
  const existingTablesByName = new Map(existing.tables.map((t) => [t.name, t]));
  const tableIdRemap = new Map<string, string>();
  const fieldIdRemap = new Map<string, string>();

  const tables: Table[] = incoming.tables.map((table, index) => {
    const prev = existingTablesByName.get(table.name);
    const finalId = prev?.id ?? table.id;
    tableIdRemap.set(table.id, finalId);

    const prevFieldsByName = new Map((prev?.fields ?? []).map((f) => [f.name, f]));
    const fields = table.fields.map((field) => {
      const finalFieldId = prevFieldsByName.get(field.name)?.id ?? field.id;
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
      position: prev?.position ?? { x: (index % 6) * 320, y: Math.floor(index / 6) * 400 },
      size: prev?.size,
      style: prev?.style,
      detailLevel: prev?.detailLevel ?? table.detailLevel,
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
    zones: existing.zones,
    stickyNotes: existing.stickyNotes,
  };
}
