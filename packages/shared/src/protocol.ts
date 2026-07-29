import type { Id } from "./schema.js";

/** One entry in a project's revision history — the actual shape returned by `GET /api/projects/:id/revisions`. */
export interface RevisionMeta {
  id: Id;
  author: string;
  label: string | null;
  createdAt: string;
}
