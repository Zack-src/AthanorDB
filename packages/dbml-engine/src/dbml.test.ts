import { test } from "node:test";
import assert from "node:assert/strict";
import type { Project } from "@athanordb/shared";
import { parseDbml, toProject, projectToDbml, projectToSql, mergeProjectIntoExisting } from "./dbml.js";

test("DBML -> Project round-trips table/field constraints", () => {
  const source = `Table users {
  id int [pk, increment]
  email varchar [unique, not null]
  bio varchar [note: 'short bio']
  age int [default: 0]
  status varchar [default: 'draft']
}`;
  const project = toProject(parseDbml(source), "Test");
  const table = project.tables[0];
  assert.equal(table.name, "users");

  const id = table.fields.find((f) => f.name === "id")!;
  assert.equal(id.pk, true);
  assert.equal(id.increment, true);

  const email = table.fields.find((f) => f.name === "email")!;
  assert.equal(email.unique, true);
  assert.equal(email.notNull, true);

  const bio = table.fields.find((f) => f.name === "bio")!;
  assert.equal(bio.note, "short bio");

  // Regression: @dbml/core gives numeric defaults back as a JS `number`, not
  // a string, even though `Field.default` is typed `string`.
  const age = table.fields.find((f) => f.name === "age")!;
  assert.strictEqual(age.default, "0");
  assert.strictEqual(typeof age.default, "string");

  const status = table.fields.find((f) => f.name === "status")!;
  assert.strictEqual(status.default, "draft");

  const regenerated = projectToDbml(project);
  assert.match(regenerated, /\bpk\b/);
  assert.match(regenerated, /\bincrement\b/);
  assert.match(regenerated, /\bunique\b/);
  assert.match(regenerated, /not null/);
  assert.match(regenerated, /default: 0/);
  assert.match(regenerated, /default: 'draft'/);
});

test("ref endpoints resolve to real table/field ids, not names (regression: used to fall back to tableName/fieldNames)", () => {
  const source = `
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
  user_id int
}

Ref: posts.user_id > users.id
`;
  const project = toProject(parseDbml(source), "Test");
  assert.equal(project.refs.length, 1);
  const ref = project.refs[0];

  const fromTable = project.tables.find((t) => t.id === ref.from.tableId);
  const toTable = project.tables.find((t) => t.id === ref.to.tableId);
  assert.ok(fromTable, `ref.from.tableId (${ref.from.tableId}) must match a real table id`);
  assert.ok(toTable, `ref.to.tableId (${ref.to.tableId}) must match a real table id`);
  assert.equal(fromTable!.name, "posts");
  assert.equal(toTable!.name, "users");

  const fromField = fromTable!.fields.find((f) => f.id === ref.from.fieldId);
  const toField = toTable!.fields.find((f) => f.id === ref.to.fieldId);
  assert.ok(fromField, `ref.from.fieldId (${ref.from.fieldId}) must match a real field id`);
  assert.ok(toField, `ref.to.fieldId (${ref.to.fieldId}) must match a real field id`);
  assert.equal(fromField!.name, "user_id");
  assert.equal(toField!.name, "id");

  // If the ids don't resolve, projectToDbml silently drops the Ref line
  // (fieldNameById returns null and the loop `continue`s) — this is the part
  // that actually surfaced the original bug.
  const dbml = projectToDbml(project);
  assert.match(dbml, /Ref:\s*posts\.user_id\s*>\s*users\.id/);
});

test("cardinality round-trips through DBML symbols", () => {
  const cases: Array<[string, Project["refs"][number]["cardinality"]]> = [
    ["-", "one-to-one"],
    [">", "one-to-many"],
    ["<>", "many-to-many"],
  ];
  for (const [symbol, expected] of cases) {
    const source = `
Table a { id int [pk] }
Table b { id int [pk] }
Ref: a.id ${symbol} b.id
`;
    const project = toProject(parseDbml(source), "Test");
    assert.equal(project.refs[0].cardinality, expected, `symbol ${symbol}`);
  }
});

test("projectToSql emits a foreign key constraint for postgres", () => {
  const source = `
Table users { id int [pk] }
Table posts {
  id int [pk]
  user_id int
}
Ref: posts.user_id > users.id
`;
  const project = toProject(parseDbml(source), "Test");
  const sql = projectToSql(project, "postgres");
  assert.match(sql, /FOREIGN KEY/i);
});

test("mergeProjectIntoExisting preserves position/detailLevel/style for tables matched by name", () => {
  const existing: Project = {
    id: "p1",
    name: "Test",
    tables: [
      {
        id: "old-id",
        name: "users",
        fields: [{ id: "old-field-id", name: "id", type: "int", pk: true }],
        indexes: [],
        position: { x: 777, y: 888 },
        detailLevel: "full",
        style: { color: "#123456" },
      },
    ],
    refs: [],
    enums: [],
    zones: [{ id: "z1", label: "Zone", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }],
    stickyNotes: [{ id: "s1", text: "note", position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }],
  };

  const incoming = toProject(
    parseDbml(`
Table users {
  id int [pk]
  email varchar
}

Table posts {
  id int [pk]
}
`),
    "Test",
  );

  const merged = mergeProjectIntoExisting(existing, incoming);

  const users = merged.tables.find((t) => t.name === "users")!;
  assert.equal(users.id, "old-id", "existing table id preserved");
  assert.deepEqual(users.position, { x: 777, y: 888 }, "existing position preserved");
  assert.equal(users.detailLevel, "full", "existing detail level preserved");
  assert.deepEqual(users.style, { color: "#123456" }, "existing style preserved");

  const idField = users.fields.find((f) => f.name === "id")!;
  assert.equal(idField.id, "old-field-id", "existing field id preserved by name match");
  const emailField = users.fields.find((f) => f.name === "email")!;
  assert.notEqual(emailField.id, "old-field-id", "new field gets a fresh id, not the existing field's");

  const posts = merged.tables.find((t) => t.name === "posts")!;
  assert.notDeepEqual(posts.position, { x: 777, y: 888 }, "new table gets its own position, not the existing table's");
  assert.equal(posts.detailLevel, "standard", "new table gets incoming's default detail level");

  assert.deepEqual(merged.zones, existing.zones, "zones pass through untouched (no DBML equivalent)");
  assert.deepEqual(merged.stickyNotes, existing.stickyNotes, "sticky notes pass through untouched");
});

test("mergeProjectIntoExisting drops tables no longer present in incoming, and remaps ref endpoints onto merged ids", () => {
  const existing: Project = {
    id: "p1",
    name: "Test",
    tables: [
      {
        id: "old-users-id",
        name: "users",
        fields: [{ id: "old-id-field", name: "id", type: "int", pk: true }],
        indexes: [],
        position: { x: 5, y: 5 },
        detailLevel: "standard",
      },
      {
        id: "old-legacy-id",
        name: "legacy",
        fields: [],
        indexes: [],
        position: { x: 1, y: 1 },
        detailLevel: "standard",
      },
    ],
    refs: [],
    enums: [],
    zones: [],
    stickyNotes: [],
  };

  const incoming = toProject(
    parseDbml(`
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  user_id int
}
Ref: posts.user_id > users.id
`),
    "Test",
  );

  const merged = mergeProjectIntoExisting(existing, incoming);

  assert.equal(
    merged.tables.find((t) => t.name === "legacy"),
    undefined,
    "table removed from the DBML source is dropped from the merged result",
  );

  const usersTable = merged.tables.find((t) => t.name === "users")!;
  assert.equal(usersTable.id, "old-users-id");

  assert.equal(merged.refs.length, 1);
  const ref = merged.refs[0];
  const toTable = merged.tables.find((t) => t.id === ref.to.tableId);
  assert.equal(
    toTable?.name,
    "users",
    "ref remapped to point at the preserved existing table id, not incoming's freshly-parsed one",
  );
  assert.equal(ref.to.tableId, "old-users-id");
});

test("enums round-trip", () => {
  const source = `
Enum status {
  active
  inactive [note: 'archived']
}
`;
  const project = toProject(parseDbml(source), "Test");
  assert.equal(project.enums.length, 1);
  assert.equal(project.enums[0].name, "status");
  assert.equal(project.enums[0].values.length, 2);

  const dbml = projectToDbml(project);
  assert.match(dbml, /Enum status \{/);
  assert.match(dbml, /active/);
  assert.match(dbml, /inactive/);
});

test("composite unique index round-trips", () => {
  const source = `
Table memberships {
  user_id int
  org_id int

  indexes {
    (user_id, org_id) [unique, name: 'uq_membership']
  }
}
`;
  const project = toProject(parseDbml(source), "Test");
  const table = project.tables[0];
  assert.equal(table.indexes.length, 1);
  assert.equal(table.indexes[0].unique, true);
  assert.equal(table.indexes[0].fieldIds.length, 2);

  const dbml = projectToDbml(project);
  assert.match(dbml, /indexes \{/);
  assert.match(dbml, /\(user_id, org_id\)/);
  assert.match(dbml, /unique/);
});

test("identifiers with special characters get quoted and re-parse cleanly", () => {
  const project: Project = {
    id: "p1",
    name: "Test",
    tables: [
      {
        id: "t1",
        name: "user profile",
        fields: [{ id: "f1", name: "id", type: "int", pk: true }],
        indexes: [],
        position: { x: 0, y: 0 },
        detailLevel: "standard",
      },
    ],
    refs: [],
    enums: [],
    zones: [],
    stickyNotes: [],
  };
  const dbml = projectToDbml(project);
  assert.match(dbml, /Table "user profile"/);

  const reparsed = toProject(parseDbml(dbml), "Test");
  assert.equal(reparsed.tables[0].name, "user profile");
});
