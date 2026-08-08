export type Id = string;

export type DetailLevel = "compact" | "standard" | "full";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface VisualStyle {
  color?: string;
  borderColor?: string;
}

export interface Field {
  id: Id;
  name: string;
  type: string;
  pk?: boolean;
  unique?: boolean;
  notNull?: boolean;
  increment?: boolean;
  default?: string;
  note?: string;
}

export interface TableIndex {
  id: Id;
  fieldIds: Id[];
  unique?: boolean;
  /** Composite primary key — DBML/SQL only represent a 2+ column PK as an index, never as multiple per-field `pk` flags. */
  pk?: boolean;
  name?: string;
}

export interface Table {
  id: Id;
  name: string;
  schemaName?: string;
  note?: string;
  fields: Field[];
  indexes: TableIndex[];
  position: Position;
  size?: Size;
  style?: VisualStyle;
  detailLevel: DetailLevel;
  comments?: Comment[];
}

export interface Comment {
  id: Id;
  author: string;
  text: string;
  createdAt: string;
  /** Present -> comment on that field; absent -> comment on the table itself. */
  fieldId?: Id;
}

export type RefCardinality = "one-to-one" | "one-to-many" | "many-to-many";

export interface RefEndpoint {
  tableId: Id;
  fieldId: Id;
}

export interface RoutingPoint {
  x: number;
  y: number;
}

export interface Ref {
  id: Id;
  name?: string;
  from: RefEndpoint;
  to: RefEndpoint;
  cardinality: RefCardinality;
  routingPoints?: RoutingPoint[];
  style?: VisualStyle;
}

export interface EnumValue {
  id: Id;
  name: string;
  note?: string;
}

export interface EnumDef {
  id: Id;
  name: string;
  values: EnumValue[];
  /** Canvas position — DBML has no notion of it (like zones/sticky notes), assigned/preserved on import same as a table's. */
  position: Position;
}

export interface Zone {
  id: Id;
  label: string;
  position: Position;
  size: Size;
  style?: VisualStyle;
}

export interface StickyNote {
  id: Id;
  text: string;
  position: Position;
  size: Size;
  style?: VisualStyle;
}

export interface Project {
  id: Id;
  name: string;
  tables: Table[];
  refs: Ref[];
  enums: EnumDef[];
  zones: Zone[];
  stickyNotes: StickyNote[];
  /** Custom preset swatch grid for this project's color pickers. Unset -> caller falls back to a built-in default palette. */
  paletteColors?: string[];
}
