import type { Id } from "./schema.js";

export interface RevisionMeta {
  id: Id;
  projectId: Id;
  author: string;
  createdAt: string;
  label?: string;
}

export type ClientMessage =
  | { type: "join"; projectId: Id; user: string }
  | { type: "leave"; projectId: Id }
  | { type: "cursor"; projectId: Id; position: { x: number; y: number } | null }
  | { type: "history:list"; projectId: Id }
  | { type: "history:restore"; projectId: Id; revisionId: Id };

export type ServerMessage =
  | { type: "presence"; projectId: Id; users: string[] }
  | { type: "cursor"; projectId: Id; user: string; position: { x: number; y: number } | null }
  | { type: "history:list"; projectId: Id; revisions: RevisionMeta[] }
  | { type: "error"; message: string };
