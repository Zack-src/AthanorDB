import { test } from "node:test";
import assert from "node:assert/strict";
import type { Table } from "./schema.js";
import {
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_PALETTE_COLORS,
  MAX_TEXT_LENGTH,
  clampCollectionValue,
  clampMetaValue,
  clampStickyNote,
  clampTable,
} from "./limits.js";
import { STICKY_NOTES_KEY, TABLES_KEY } from "./yjsBinding.js";

function sampleTable(overrides: Partial<Table> = {}): Table {
  return {
    id: "t1",
    name: "users",
    fields: [{ id: "f1", name: "id", type: "int", pk: true }],
    indexes: [],
    position: { x: 0, y: 0 },
    detailLevel: "standard",
    ...overrides,
  };
}

test("clampTable returns null when everything is within limits", () => {
  assert.equal(clampTable(sampleTable()), null);
});

test("clampTable truncates an over-long table name", () => {
  const clamped = clampTable(sampleTable({ name: "a".repeat(MAX_NAME_LENGTH + 500) }));
  assert.ok(clamped);
  assert.equal(clamped.name.length, MAX_NAME_LENGTH);
  assert.equal(clamped.id, "t1");
});

test("clampTable truncates nested field, index, comment and note strings", () => {
  const clamped = clampTable(
    sampleTable({
      note: "n".repeat(MAX_NOTE_LENGTH + 1),
      fields: [
        {
          id: "f1",
          name: "x".repeat(MAX_NAME_LENGTH + 1),
          type: "y".repeat(MAX_NAME_LENGTH + 1),
          default: "d".repeat(5000),
          note: "z".repeat(MAX_NOTE_LENGTH + 1),
        },
      ],
      indexes: [{ id: "i1", fieldIds: ["f1"], name: "i".repeat(MAX_NAME_LENGTH + 1) }],
      comments: [
        {
          id: "c1",
          author: "u".repeat(500),
          text: "t".repeat(MAX_TEXT_LENGTH + 1),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  );
  assert.ok(clamped);
  assert.equal(clamped.note?.length, MAX_NOTE_LENGTH);
  assert.equal(clamped.fields[0].name.length, MAX_NAME_LENGTH);
  assert.equal(clamped.fields[0].type.length, MAX_NAME_LENGTH);
  assert.equal(clamped.fields[0].default?.length, 500);
  assert.equal(clamped.fields[0].note?.length, MAX_NOTE_LENGTH);
  assert.equal(clamped.indexes[0].name?.length, MAX_NAME_LENGTH);
  assert.equal(clamped.comments?.[0].text.length, MAX_TEXT_LENGTH);
  assert.equal(clamped.comments?.[0].author.length, 100);
});

test("clampTable survives a hostile entity whose arrays are not arrays", () => {
  const hostile = { ...sampleTable(), fields: "nope", indexes: null, style: 7 } as unknown as Table;
  assert.equal(clampTable(hostile), null);

  const hostileAndLong = { ...hostile, name: "a".repeat(MAX_NAME_LENGTH + 1) } as unknown as Table;
  const clamped = clampTable(hostileAndLong);
  assert.ok(clamped);
  assert.equal(clamped.name.length, MAX_NAME_LENGTH);
  assert.equal(clamped.fields as unknown, "nope");
});

test("clampStickyNote truncates text and style colors", () => {
  const clamped = clampStickyNote({
    id: "s1",
    text: "t".repeat(MAX_TEXT_LENGTH + 1),
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    style: { color: "#".repeat(500) },
  });
  assert.ok(clamped);
  assert.equal(clamped.text.length, MAX_TEXT_LENGTH);
  assert.equal(clamped.style?.color?.length, 64);
});

test("clampCollectionValue dispatches by collection key and ignores non-entities", () => {
  const table = clampCollectionValue(TABLES_KEY, sampleTable({ name: "a".repeat(MAX_NAME_LENGTH + 1) })) as Table;
  assert.equal(table.name.length, MAX_NAME_LENGTH);
  assert.equal(clampCollectionValue(STICKY_NOTES_KEY, "not an object"), null);
  assert.equal(clampCollectionValue("unknownCollection", sampleTable()), null);
});

test("clampMetaValue caps the project name and the palette", () => {
  assert.equal(clampMetaValue("name", "ok"), null);
  assert.equal((clampMetaValue("name", "a".repeat(MAX_NAME_LENGTH + 1)) as string).length, MAX_NAME_LENGTH);

  const palette = Array.from({ length: MAX_PALETTE_COLORS + 10 }, () => "#000000");
  assert.equal((clampMetaValue("paletteColors", palette) as string[]).length, MAX_PALETTE_COLORS);
  assert.equal(clampMetaValue("paletteColors", ["#000000"]), null);
  assert.equal((clampMetaValue("paletteColors", ["#".repeat(200)]) as string[])[0].length, 64);

  assert.equal(clampMetaValue("id", "p1"), null);
});
