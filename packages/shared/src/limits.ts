import type { Comment, EnumDef, EnumValue, Field, Ref, StickyNote, Table, TableIndex, Zone } from "./schema.js";
import { ENUMS_KEY, REFS_KEY, STICKY_NOTES_KEY, TABLES_KEY, ZONES_KEY } from "./yjsBinding.js";

/**
 * Maximum lengths for every user-typed string that lives inside a project.
 *
 * These are the single source of truth for both sides: the web client uses
 * them for `maxLength` on its inputs (a UX nicety), and the server re-applies
 * them to the document after every incoming Yjs update (the actual
 * enforcement — a hand-crafted WS frame never touches the client's inputs).
 */
export const MAX_NAME_LENGTH = 200;
export const MAX_TYPE_LENGTH = 200;
export const MAX_DEFAULT_LENGTH = 500;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_AUTHOR_LENGTH = 100;
export const MAX_COLOR_LENGTH = 64;
export const MAX_PALETTE_COLORS = 64;

interface ClipState {
  changed: boolean;
}

function clipText<T extends string | undefined>(value: T, max: number, state: ClipState): T {
  if (typeof value === "string" && value.length > max) {
    state.changed = true;
    return value.slice(0, max) as T;
  }
  return value;
}

/**
 * Entity arrays arrive as opaque JSON from whoever sent the update, so a
 * hostile client can put a non-array (or nothing) where the schema promises a
 * list. Map only what is really an array and leave anything else untouched —
 * clamping is a length guard, not a schema validator.
 */
function clipEach<T>(
  values: T[] | undefined,
  clip: (value: T, state: ClipState) => T,
  state: ClipState,
): T[] | undefined {
  if (!Array.isArray(values)) return values;
  return values.map((value) => (value && typeof value === "object" ? clip(value, state) : value));
}

function clipStyle<T extends { color?: string; borderColor?: string } | undefined>(style: T, state: ClipState): T {
  if (!style || typeof style !== "object") return style;
  return {
    ...style,
    color: clipText(style.color, MAX_COLOR_LENGTH, state),
    borderColor: clipText(style.borderColor, MAX_COLOR_LENGTH, state),
  };
}

function clipField(field: Field, state: ClipState): Field {
  return {
    ...field,
    name: clipText(field.name, MAX_NAME_LENGTH, state),
    type: clipText(field.type, MAX_TYPE_LENGTH, state),
    default: clipText(field.default, MAX_DEFAULT_LENGTH, state),
    note: clipText(field.note, MAX_NOTE_LENGTH, state),
  };
}

function clipIndex(index: TableIndex, state: ClipState): TableIndex {
  return { ...index, name: clipText(index.name, MAX_NAME_LENGTH, state) };
}

function clipComment(comment: Comment, state: ClipState): Comment {
  return {
    ...comment,
    author: clipText(comment.author, MAX_AUTHOR_LENGTH, state),
    text: clipText(comment.text, MAX_TEXT_LENGTH, state),
  };
}

function clipEnumValue(value: EnumValue, state: ClipState): EnumValue {
  return {
    ...value,
    name: clipText(value.name, MAX_NAME_LENGTH, state),
    note: clipText(value.note, MAX_NOTE_LENGTH, state),
  };
}

/** Returns a clamped copy, or `null` when nothing exceeded a limit (so the caller can skip the write). */
export function clampTable(table: Table): Table | null {
  const state: ClipState = { changed: false };
  const next: Table = {
    ...table,
    name: clipText(table.name, MAX_NAME_LENGTH, state),
    schemaName: clipText(table.schemaName, MAX_NAME_LENGTH, state),
    note: clipText(table.note, MAX_NOTE_LENGTH, state),
    fields: clipEach(table.fields, clipField, state) as Field[],
    indexes: clipEach(table.indexes, clipIndex, state) as TableIndex[],
    comments: clipEach(table.comments, clipComment, state),
    style: clipStyle(table.style, state),
  };
  return state.changed ? next : null;
}

export function clampRef(ref: Ref): Ref | null {
  const state: ClipState = { changed: false };
  const next: Ref = {
    ...ref,
    name: clipText(ref.name, MAX_NAME_LENGTH, state),
    style: clipStyle(ref.style, state),
  };
  return state.changed ? next : null;
}

export function clampEnum(enumDef: EnumDef): EnumDef | null {
  const state: ClipState = { changed: false };
  const next: EnumDef = {
    ...enumDef,
    name: clipText(enumDef.name, MAX_NAME_LENGTH, state),
    values: clipEach(enumDef.values, clipEnumValue, state) as EnumValue[],
  };
  return state.changed ? next : null;
}

export function clampZone(zone: Zone): Zone | null {
  const state: ClipState = { changed: false };
  const next: Zone = {
    ...zone,
    label: clipText(zone.label, MAX_NAME_LENGTH, state),
    style: clipStyle(zone.style, state),
  };
  return state.changed ? next : null;
}

export function clampStickyNote(note: StickyNote): StickyNote | null {
  const state: ClipState = { changed: false };
  const next: StickyNote = {
    ...note,
    text: clipText(note.text, MAX_TEXT_LENGTH, state),
    style: clipStyle(note.style, state),
  };
  return state.changed ? next : null;
}

/**
 * Clamps one entity of the collection named by its top-level Y.Map key.
 * Returns `null` when the value is already within limits (or isn't an entity
 * object at all), meaning "no write needed".
 */
export function clampCollectionValue(collection: string, value: unknown): unknown | null {
  if (!value || typeof value !== "object") return null;
  switch (collection) {
    case TABLES_KEY:
      return clampTable(value as Table);
    case REFS_KEY:
      return clampRef(value as Ref);
    case ENUMS_KEY:
      return clampEnum(value as EnumDef);
    case ZONES_KEY:
      return clampZone(value as Zone);
    case STICKY_NOTES_KEY:
      return clampStickyNote(value as StickyNote);
    default:
      return null;
  }
}

/** Same contract as `clampCollectionValue`, for the flat `meta` map's scalar entries. */
export function clampMetaValue(key: string, value: unknown): unknown | null {
  const state: ClipState = { changed: false };
  if (key === "name") {
    if (typeof value !== "string") return null;
    const next = clipText(value, MAX_NAME_LENGTH, state);
    return state.changed ? next : null;
  }
  if (key === "paletteColors") {
    if (!Array.isArray(value)) return null;
    // An unbounded palette is the one place a single map entry can grow
    // without limit no matter how short each string is, so cap the count too.
    const capped = value.length > MAX_PALETTE_COLORS ? value.slice(0, MAX_PALETTE_COLORS) : value;
    if (capped !== value) state.changed = true;
    const next = capped.map((color: unknown) =>
      typeof color === "string" ? clipText(color, MAX_COLOR_LENGTH, state) : color,
    );
    return state.changed ? next : null;
  }
  return null;
}
