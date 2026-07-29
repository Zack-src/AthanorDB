import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readProjectFromDoc } from "@athanordb/shared";
import { projectToDbml } from "@athanordb/dbml-engine";
import { db } from "./db.js";
import { listRevisions, reconstructDocAtRevision } from "./yjs/persistence.js";

/**
 * Dumps every project to a `.dbml` file — a basic, dependency-free backup
 * path that doesn't require the server to be running. Reconstructs each
 * project from its revision log up to the latest revision (the same
 * replay `reconstructDocAtRevision` does for the History panel's restore
 * flow) rather than trusting the debounced snapshot, which can lag live
 * edits by a couple of seconds.
 *
 * Usage: `npm run backup -w apps/server -- [outputDir]` (defaults to
 * `./backups/<timestamp>/`). Respects `ATHANORDB_DB_PATH` the same as the
 * server itself, so it reads whichever database the server is actually using.
 */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : "untitled";
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function main(): void {
  const outDir = process.argv[2] ?? path.join("backups", timestamp());
  mkdirSync(outDir, { recursive: true });

  const projects = db.prepare("SELECT id, name FROM projects ORDER BY name").all() as { id: string; name: string }[];
  if (projects.length === 0) {
    console.log("No projects found — nothing to back up.");
    return;
  }

  const usedNames = new Map<string, number>();
  let backedUp = 0;
  let skipped = 0;

  for (const project of projects) {
    const revisions = listRevisions(project.id);
    if (revisions.length === 0) {
      console.log(`skip  ${project.name} — no revisions yet (nothing committed to back up)`);
      skipped++;
      continue;
    }

    const lastRevisionId = revisions[revisions.length - 1].id;
    const doc = reconstructDocAtRevision(project.id, lastRevisionId);
    if (!doc) {
      console.log(`skip  ${project.name} — revision log could not be replayed`);
      skipped++;
      continue;
    }

    const liveProject = readProjectFromDoc(doc, project.id, project.name);
    const dbml = projectToDbml(liveProject, { includeVisualMetadata: true });

    const base = sanitizeFilename(project.name);
    const dupeCount = usedNames.get(base) ?? 0;
    usedNames.set(base, dupeCount + 1);
    const filename = dupeCount === 0 ? `${base}.dbml` : `${base}-${dupeCount}.dbml`;

    writeFileSync(path.join(outDir, filename), dbml, "utf-8");
    console.log(`ok    ${project.name} -> ${filename}`);
    backedUp++;
  }

  console.log(`\n${backedUp} project(s) backed up, ${skipped} skipped, written to ${path.resolve(outDir)}`);
}

main();
