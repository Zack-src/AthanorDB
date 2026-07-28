import { Parser, ModelExporter } from "@dbml/core";
import type { Project } from "@athanordb/shared";

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
  const tables = (schema?.tables ?? []).map((table: any, index: number) => ({
    id: String(table.id ?? table.name),
    name: table.name,
    schemaName: schema?.name,
    note: table.note ?? undefined,
    fields: (table.fields ?? []).map((field: any) => ({
      id: String(field.id ?? `${table.name}.${field.name}`),
      name: field.name,
      type: field.type?.type_name ?? String(field.type),
      pk: field.pk ?? false,
      unique: field.unique ?? false,
      notNull: field.not_null ?? false,
      increment: field.increment ?? false,
      default: field.dbdefault?.value ?? undefined,
      note: field.note ?? undefined,
    })),
    indexes: (table.indexes ?? []).map((idx: any) => ({
      id: String(idx.id ?? `${table.name}.idx`),
      fieldIds: (idx.columns ?? []).map((c: any) => String(c.value ?? c)),
      unique: idx.unique ?? false,
      name: idx.name ?? undefined,
    })),
    position: { x: (index % 6) * 320, y: Math.floor(index / 6) * 400 },
    detailLevel: "standard" as const,
  }));

  const refs = (schema?.refs ?? []).map((ref: any, i: number) => {
    const [from, to] = ref.endpoints;
    return {
      id: String(ref.id ?? `ref-${i}`),
      name: ref.name ?? undefined,
      from: { tableId: String(from.tableId ?? from.tableName), fieldId: String(from.fieldId ?? from.fieldNames?.[0]) },
      to: { tableId: String(to.tableId ?? to.tableName), fieldId: String(to.fieldId ?? to.fieldNames?.[0]) },
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
