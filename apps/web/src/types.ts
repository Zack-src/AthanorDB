import type { TableNodeType } from "./TableNode.js";
import type { ZoneNodeType } from "./ZoneNode.js";
import type { StickyNoteNodeType } from "./StickyNoteNode.js";
import type { CursorNodeType } from "./CursorNode.js";

export type CanvasNode = TableNodeType | ZoneNodeType | StickyNoteNodeType;
export type AllNodes = CanvasNode | CursorNodeType;

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
}

export type SqlDialect = "postgres" | "mysql" | "mssql";
export type ImageFormat = "png" | "svg" | "pdf";
export type ExportFormat = "dbml" | SqlDialect | ImageFormat;

export interface CanvasImageCapture {
  dataUrl: string;
  width: number;
  height: number;
}

export interface CanvasExportHandle {
  capture: (format: "png" | "svg") => Promise<CanvasImageCapture>;
}
