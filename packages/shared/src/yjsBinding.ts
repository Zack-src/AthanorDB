import * as Y from "yjs";
import type { EnumDef, Id, Project, Ref, StickyNote, Table, Zone } from "./schema.js";

/**
 * Bridges the plain-object `Project` shape to a Y.Doc so the server and web
 * client share one definition of "what a project looks like inside Yjs".
 * Each collection is a top-level Y.Map keyed by entity id; entity values are
 * stored as plain JSON (opaque to Yjs) — merge granularity is per-entity, not
 * per-field, until Phase 5/6 needs finer-grained collaborative editing.
 */
export const META_KEY = "meta";
export const TABLES_KEY = "tables";
export const REFS_KEY = "refs";
export const ENUMS_KEY = "enums";
export const ZONES_KEY = "zones";
export const STICKY_NOTES_KEY = "stickyNotes";

export function getMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(META_KEY);
}

export function getTablesMap(doc: Y.Doc): Y.Map<Table> {
  return doc.getMap(TABLES_KEY);
}

export function getRefsMap(doc: Y.Doc): Y.Map<Ref> {
  return doc.getMap(REFS_KEY);
}

export function getEnumsMap(doc: Y.Doc): Y.Map<EnumDef> {
  return doc.getMap(ENUMS_KEY);
}

export function getZonesMap(doc: Y.Doc): Y.Map<Zone> {
  return doc.getMap(ZONES_KEY);
}

export function getStickyNotesMap(doc: Y.Doc): Y.Map<StickyNote> {
  return doc.getMap(STICKY_NOTES_KEY);
}

function replaceMapContents<T>(map: Y.Map<T>, entries: [Id, T][]): void {
  Array.from(map.keys()).forEach((key) => map.delete(key));
  entries.forEach(([id, value]) => map.set(id, value));
}

/** Overwrite the doc's project content in a single transaction. */
export function writeProjectToDoc(doc: Y.Doc, project: Project): void {
  doc.transact(() => {
    const meta = getMetaMap(doc);
    meta.set("id", project.id);
    meta.set("name", project.name);

    replaceMapContents(
      getTablesMap(doc),
      project.tables.map((t) => [t.id, t]),
    );
    replaceMapContents(
      getRefsMap(doc),
      project.refs.map((r) => [r.id, r]),
    );
    replaceMapContents(
      getEnumsMap(doc),
      project.enums.map((e) => [e.id, e]),
    );
    replaceMapContents(
      getZonesMap(doc),
      project.zones.map((z) => [z.id, z]),
    );
    replaceMapContents(
      getStickyNotesMap(doc),
      project.stickyNotes.map((s) => [s.id, s]),
    );
  });
}

/** Read the doc's current content back into a plain `Project`. */
export function readProjectFromDoc(doc: Y.Doc, fallbackId: string, fallbackName = "Untitled"): Project {
  const meta = getMetaMap(doc);
  return {
    id: (meta.get("id") as string | undefined) ?? fallbackId,
    name: (meta.get("name") as string | undefined) ?? fallbackName,
    tables: Array.from(getTablesMap(doc).values()),
    refs: Array.from(getRefsMap(doc).values()),
    enums: Array.from(getEnumsMap(doc).values()),
    zones: Array.from(getZonesMap(doc).values()),
    stickyNotes: Array.from(getStickyNotesMap(doc).values()),
  };
}
