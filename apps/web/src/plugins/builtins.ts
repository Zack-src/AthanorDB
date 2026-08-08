import type { Project } from "@athanordb/shared";
import type {
  Contribution,
  ContributionKind,
  InvokeContext,
  InvokeInput,
  InvokeResult,
  PluginManifest,
} from "./types.js";

/** Bound when contributions are resolved: which project they will act on. */
export interface PluginRunContext {
  projectId: string;
}

/** What a built-in's `run` gets: the resolve-time project plus the same per-call context a sandboxed plugin receives. */
export type BuiltinRunContext = PluginRunContext & InvokeContext;

/**
 * A plugin that ships with the app. Built-ins implement exactly the same
 * contribution contract as sandboxed user plugins, so the registry, the export
 * dialog, the import dialog and the command menus never special-case them —
 * they just run in-process instead of in a Worker, which is what lets them
 * reach the server routes that hold the heavyweight `@dbml/core` parser.
 */
export interface BuiltinPlugin {
  manifest: PluginManifest;
  contributions: Contribution[];
  run: (kind: ContributionKind, id: string, input: InvokeInput, ctx: BuiltinRunContext) => Promise<InvokeResult>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  return res.text();
}

async function sqlToDbml(source: string, dialect: string): Promise<string> {
  const res = await fetch("/api/convert/to-dbml", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, dialect }),
  });
  const data = (await res.json().catch(() => ({}))) as { dbml?: string; error?: string };
  if (!res.ok || typeof data.dbml !== "string") throw new Error(data.error ?? `conversion failed (${res.status})`);
  return data.dbml;
}

const SQL_DIALECTS = [
  { id: "postgres", label: "SQL — Postgres" },
  { id: "mysql", label: "SQL — MySQL" },
  { id: "mssql", label: "SQL — SQL Server" },
] as const;

/**
 * The export formats AthanorDB has always had, restated as a plugin. Nothing
 * else in the app knows the dialect list any more: adding Postgres-flavoured
 * output and adding a user plugin's own dialect are now the same operation.
 */
const coreExport: BuiltinPlugin = {
  manifest: {
    id: "athanordb.core-export",
    name: "Core export formats",
    version: "1.0.0",
    description: "DBML and SQL (Postgres, MySQL, SQL Server) export, generated server-side by @dbml/core.",
    author: "AthanorDB",
    settings: [
      {
        key: "includeVisualMetadata",
        label: "Include canvas layout in DBML export",
        type: "boolean",
        default: true,
        description: "Positions, colors and detail levels are appended as a comment block, so re-importing restores the layout.",
      },
    ],
  },
  contributions: [
    { kind: "exporter", id: "dbml", label: "DBML", extension: "dbml", description: "Native format, including canvas layout metadata." },
    ...SQL_DIALECTS.map(
      (d): Contribution => ({ kind: "exporter", id: d.id, label: d.label, extension: "sql", description: `CREATE TABLE statements for ${d.label.replace("SQL — ", "")}.` }),
    ),
  ],
  async run(kind, id, _input, ctx) {
    if (kind !== "exporter") throw new Error(`unsupported contribution ${kind}`);
    if (id === "dbml") {
      const visual = ctx.settings.includeVisualMetadata === false ? "" : "?visual=1";
      return { text: await fetchText(`/api/projects/${ctx.projectId}/export/dbml${visual}`), extension: "dbml" };
    }
    return { text: await fetchText(`/api/projects/${ctx.projectId}/export/sql?dialect=${id}`), extension: "sql" };
  },
};

/**
 * The import side of the same story. Every importer — built-in or plugin —
 * returns DBML, which the caller then applies through the existing
 * merge-by-name import route.
 */
const coreImport: BuiltinPlugin = {
  manifest: {
    id: "athanordb.core-import",
    name: "Core import formats",
    version: "1.0.0",
    description: "DBML passthrough and SQL DDL parsing (Postgres, MySQL, SQL Server).",
    author: "AthanorDB",
  },
  contributions: [
    { kind: "importer", id: "dbml", label: "DBML", fileExtensions: ["dbml"], description: "Paste or upload DBML source." },
    ...SQL_DIALECTS.map(
      (d): Contribution => ({ kind: "importer", id: d.id, label: d.label, fileExtensions: ["sql"], description: `Parse ${d.label.replace("SQL — ", "")} DDL.` }),
    ),
  ],
  async run(kind, id, input) {
    if (kind !== "importer") throw new Error(`unsupported contribution ${kind}`);
    const source = typeof input === "string" ? input : "";
    if (id === "dbml") return { dbml: source };
    return { dbml: await sqlToDbml(source, id) };
  },
};

/**
 * "Reset links", previously a toolbar button wired straight into
 * `useProjectMutations`, now expressed as a canvas command — the same shape a
 * user plugin uses to mutate the schema.
 */
const coreCanvas: BuiltinPlugin = {
  manifest: {
    id: "athanordb.core-canvas",
    name: "Core canvas commands",
    version: "1.0.0",
    description: "Layout and cleanup commands that ship with AthanorDB.",
    author: "AthanorDB",
  },
  contributions: [
    {
      kind: "canvasCommand",
      id: "reset-link-routing",
      label: "Reset link routing",
      description: "Drops manually placed routing points — only for the selected tables' links when something is selected.",
      shortcut: "Ctrl+Alt+R",
    },
  ],
  async run(kind, id, input, ctx) {
    if (kind !== "canvasCommand" || id !== "reset-link-routing") throw new Error(`unsupported contribution ${kind}/${id}`);
    const project = input as Project;
    // With a selection, only touch links attached to it — the whole-diagram
    // reset stays one click away by deselecting first.
    const selected = new Set(ctx.selection.tableIds);
    const inScope = (ref: Project["refs"][number]) =>
      selected.size === 0 || selected.has(ref.from.tableId) || selected.has(ref.to.tableId);

    const refs = project.refs.map((ref) => {
      if (!ref.routingPoints || ref.routingPoints.length === 0 || !inScope(ref)) return ref;
      return { ...ref, routingPoints: undefined };
    });
    const changed = refs.some((ref, i) => ref !== project.refs[i]);
    if (!changed) return { project: null, message: "No manual routing to reset" };
    return {
      project: { ...project, refs },
      message: selected.size > 0 ? `Link routing reset for ${selected.size} selected table(s)` : "Link routing reset",
    };
  },
};

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [coreExport, coreImport, coreCanvas];
